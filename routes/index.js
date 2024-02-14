import express from 'express';
import AppController from '../controllers/AppController';
import AuthController from '../controllers/AuthController';

const UsersController = require('../controllers/UsersController');
const FilesController = require('../controllers/FilesController');

const router = express.Router();

// the get Routes
router.get('/status', AppController.getStatus);
router.get('/stats', AppController.getStats);
router.post('/users', UsersController.postNew);
router.post('/files', FilesController.postUpload);
router.get('/connect', AuthController.getConnect);
router.get('/disconnect', AuthController.getDisconnect);
router.get('/users/me', UsersController.getMe);
router.put('/files/:id/publish', FilesController.putPublish);
router.put('/files/:id/publish', FilesController.putUnpublish);
router.get('/files/:id', FilesController.getShow);
router.get('/files', FilesController.getIndex);

module.exports = router;
