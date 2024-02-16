import { ObjectId } from 'mongodb';

const Queue = require('bull');
const imageThumbnail = require('image-thumbnail');
const fsPromises = require('fs').promises;

const fileQueue = new Queue('fileQueue');
const dbClient = require('./utils/db');

fileQueue.process(async (job) => {
  const { fileId, userId } = job.data;

  if (!fileId) {
    throw new Error('Missing fileId');
  }
  if (!userId) {
    throw new Error('Missing userId');
  }
  const file = await dbClient.db
    .collection('files')
    .findOne({ _id: ObjectId(fileId), userId });
  if (!file) {
    throw new Error('File not found');
  }
  const sizes = [500, 250, 100];
  const promises = sizes.map((size) => imageThumbnail(file.localPath, { width: size })
    .then((thumbnail) => {
      const thumbnailPath = `${file.localPath}_${size}`;
      return fsPromises.writeFile(thumbnailPath, thumbnail);
    }));

  await Promise.all(promises);
});
