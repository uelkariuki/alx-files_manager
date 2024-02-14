import { promises as fsPromises } from 'fs';
import { ObjectId } from 'mongodb';
import redisClient from '../utils/redis';

const { v4: uuidv4 } = require('uuid');
const dbClient = require('../utils/db');

exports.postUpload = async (req, res) => {
  // retrieve the user based on the token
  const token = req.headers['X-token'];
  const userId = await redisClient.get(`auth_${token}`);

  // If not found, return an error Unauthorized with a status code 401
  if (!userId) {
    return res.status(401).send({ error: 'Unauthorized' });
  }

  // extract file details from req body
  const {
    name, type, parentId = '0', isPublic = false, data,
  } = req.body;

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
  const filePath = `${process.env.FOLDER_PATH || '/tmp/files_manager'}/${uuidv4()}`;

  const newFile = {
    userId,
    name,
    type,
    parentId,
    isPublic,
    localPath: type !== 'folder' ? filePath : undefined,
  };
  if (type !== 'folder') {
    await fsPromises.writeFile(filePath, Buffer.from(data, 'base64'));
  }
  //   save the file doc in the database
  const result = await dbClient.db.collection('files').insertOne(newFile);
  newFile._id = result.insertedId;

  return res.status(201).json(newFile);
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

exports.getShow = async (request, response) => {
  const token = request.headers['x-token'];
  if (!token) { return response.status(401).json({ error: 'Unauthorized' }); }
  const keyID = await redisClient.get(`auth_${token}`);
  if (!keyID) { return response.status(401).json({ error: 'Unauthorized' }); }
  const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(keyID) });
  if (!user) { return response.status(401).json({ error: 'Unauthorized' }); }

  const idFile = request.params.id || '';
  const fileDocument = await dbClient.db
    .collection('files')
    .findOne({ _id: ObjectId(idFile), userId: user._id });
  if (!fileDocument) return response.status(404).send({ error: 'Not found' });

  return response.send({
    id: fileDocument._id,
    userId: fileDocument.userId,
    name: fileDocument.name,
    type: fileDocument.type,
    isPublic: fileDocument.isPublic,
    parentId: fileDocument.parentId,
  });
};

exports.getIndex = async (request, response) => {
  const token = request.headers['x-token'];
  if (!token) { return response.status(401).json({ error: 'Unauthorized' }); }
  const keyID = await redisClient.get(`auth_${token}`);
  if (!keyID) { return response.status(401).json({ error: 'Unauthorized' }); }
  const parentId = request.query.parentId || '0';
  const pagination = request.query.page || 0;
  const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(keyID) });
  if (!user) response.status(401).json({ error: 'Unauthorized' });

  const aggregationMatch = { $and: [{ parentId }] };
  let aggregateData = [
    { $match: aggregationMatch },
    { $skip: pagination * 20 },
    { $limit: 20 },
  ];
  if (parentId === 0) aggregateData = [{ $skip: pagination * 20 }, { $limit: 20 }];

  const files = await dbClient.db
    .collection('files')
    .aggregate(aggregateData);
  const filesArray = [];
  await files.forEach((item) => {
    const fileItem = {
      id: item._id,
      userId: item.userId,
      name: item.name,
      type: item.type,
      isPublic: item.isPublic,
      parentId: item.parentId,
    };
    filesArray.push(fileItem);
  });

  return response.send(filesArray);
};
