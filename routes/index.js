import express from 'express';
import AppController from '../controllers/AppController';

const UsersController = require('../controllers/UsersController');

const router = express.Router();

// the get Routes
router.get('/status', AppController.getStatus);
router.get('/stats', AppController.getStats);
router.post('/users', UsersController.postNew);

module.exports = router;
