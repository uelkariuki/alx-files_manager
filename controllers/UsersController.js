const crypto = require('crypto');
const client = require('../utils/db');

exports.postNew = async (req, res) => {
  const { email, password } = req.body;

  if (!email) {
    return res.status(400).send({ error: 'Missing email' });
  }
  if (!password) {
    return res.status(400).send({ error: 'Missing password' });
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
      return res.status(400).send({ error: 'Already exist' });
    }
    // if user does not exist insert a new user with hashed password
    const result = await client.dbClient.db
      .collection('users')
      .insertOne({ email, password: hashedPassword });
    const user = result.ops[0];
    return res.status(201).json({ id: user._id, email });
  } catch (err) {
    console.error(err);
    return res.status(500);
  }
};
