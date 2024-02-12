const client = require('../utils/db');

exports.postNew = async (req, res) => {
  const { email, password } = req.body;

  if (!email) {
    res.status(400).send({ error: 'Missing email' });
  }
  if (!password) {
    res.status(400).send({ error: 'Missing password' });
  }

  // hashing the password using SHA1
  const hashedPassword = crypto
    .createHash('sha1')
    .update(password)
    .digest('hex');

  try {
    // check if user with an email already exists
    const userExists = await client.dbClient.db
      .collection('users')
      .findOne({ email });
    if (userExists) {
      res.status(400).send({ error: 'Already exist' });
    }
    // if user does not exist insert a new user with hashed password
    const user = await client.dbClient.db
      .collection('users')
      .insertOne({ email, password: hashedPassword });
    return res.status(201).json(user.ops[0]);
  } catch (err) {
    console.error(err);
  }
};
