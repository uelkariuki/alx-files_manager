const fs = require('fs');
const path = require('path');
const { ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const dbClient = require('../utils/db');

exports.postUpload = async (req, res) => {
  // retrieve the user based on the token
  const token = req.headers['x-token'];
  const user = await dbClient.db.collection('users').findOne({ token });

  // If not found, return an error Unauthorized with a status code 401
  if (!user) {
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
