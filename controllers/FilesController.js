import fs from 'fs';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';

const path = require('path');
const { v4: uuidv4 } = require('uuid');

exports.postUpload = async (req, res) => {
  // retrieve the user based on the token
  const token = req.headers['x-token'];
  const user = await dbClient.db.collection('users').findOne({ token });

  // If not found, return an error Unauthorized with a status code 401
  if (!user) {
    return res.status(401).send({ error: 'Unauthorized' });
  }

  // extract file details from req body
  const { name, type, parentId = '0', isPublic = false, data } = req.body;

  // validate fields that are provided
  if (!name) {
    return res.status(400).send({ error: 'Missing name' });
  }
  if (!type || !['folder', 'file', 'image'].includes(type)) {
    return res.status(400).send({ error: 'Missing type' });
  }
  if (!data && type !== 'folder') {
    return res.status(400).send({ error: 'Missing data' });
  }
  if (parentId !== '0') {
    const parent = await dbClient.db
      .collection('files')
      .findOne({ _id: ObjectId(parentId) });
    if (!parent) {
      return res.status(400).send({ error: 'Parent not found' });
    }
    if (parent.type !== 'folder') {
      return res.status(400).send({ error: 'Parent is not a folder' });
    }
  }
  let filePath = '';
  if (type === 'file' || type === 'image') {
    // decode Base64 data to a Buffer
    const buffer = Buffer.from(data, 'base64');
    // create a unique filename with a uuid
    const filename = uuidv4();
    // determine the storage folder path
    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    // create the full file path
    filePath = path.join(folderPath, filename);
    // write file to disk
    fs.writeFileSync(filePath, buffer);
  }

  //  create a new file in DB
  const result = await dbClient.db.collection('files').insertOne({
    userId: ObjectId(user._id),
    name,
    type,
    parentId: ObjectId(parentId),
    isPublic,
    path: filePath,
  });

  // return the new file
  const file = result.ops[0];
  return res.status(201).json({
    id: file._id,
    name: file.name,
    type: file.type,
    isPublic: file.isPublic,
  });
};

exports.putPublish = async (req, res) => {
  // Retrieve the user based on token
  const token = req.headers['x-token'];
  const user = await dbClient.db.collection('users').findOne({ token });

  if (!user) {
    return res.status(401).send({ error: 'Unauthorized' });
  }
  // extract id from req parameters
  const fileId = req.params.id;
  // find file doc linked to user and the ID passed as parameter
  const file = await dbClient.db
    .collection('files')
    .findOne({ _id: ObjectId(fileId), userId: ObjectId(user._id) });

  if (!file) {
    return res.status(404).send({ error: 'Not found' });
  }
  // update isPublic to true
  await dbClient.db
    .collection('files')
    .updateOne({ _id: ObjectId(fileId) }, { $set: { isPublic: true } });

  // return updated file doc with status code 200
  const updatedFile = await dbClient.db
    .collection('files')
    .findOne({ _id: ObjectId(fileId) });
  return res.status(200).json(updatedFile);
};

exports.putUnpublish = async (req, res) => {
  // Retrieve the user based on token
  const token = req.headers['x-token'];
  const user = await dbClient.db.collection('users').findOne({ token });

  if (!user) {
    return res.status(401).send({ error: 'Unauthorized' });
  }
  // extract id from req parameters
  const fileId = req.params.id;
  // find file doc linked to user and the ID passed as parameter
  const file = await dbClient.db
    .collection('files')
    .findOne({ _id: ObjectId(fileId), userId: ObjectId(user._id) });

  if (!file) {
    return res.status(404).send({ error: 'Not found' });
  }
  // update isPublic to false
  await dbClient.db
    .collection('files')
    .updateOne({ _id: ObjectId(fileId) }, { $set: { isPublic: false } });

  // return updated file doc with status code 200
  const updatedFile = await dbClient.db
    .collection('files')
    .findOne({ _id: ObjectId(fileId) });
  return res.status(200).json(updatedFile);
};
