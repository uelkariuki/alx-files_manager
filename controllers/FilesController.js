const fs = require('fs');
const path = require('path');
const { ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const dbClient = require('../utils/db');

import redisClient from '../utils/redis';

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

exports.getShow = async (request, response) => {
	const token = request.headers['x-token'];
	if (!token) { return response.status(401).json({ error: 'Unauthorized' }); }
	const keyID = await redisClient.get(`auth_${token}`);
	if (!keyID) { return response.status(401).json({ error: 'Unauthorized' }); }
	const user = await dbClient.db.collection('users').findOne({ _id: ObjectID(keyID) });
	if (!user) { return response.status(401).json({ error: 'Unauthorized' }); }

	const idFile = request.params.id || '';
	const fileDocument = await dbClient.db
		.collection('files')
		.findOne({ _id: ObjectID(idFile), userId: user._id });
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
	const user = await dbClient.db.collection('users').findOne({ _id: ObjectID(keyID) });
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
