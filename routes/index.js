const UsersController = require('../controllers/UsersController');

router.post('/users', UsersController.postNew);
