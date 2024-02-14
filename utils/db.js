import { MongoClient } from 'mongodb';

const host = process.env.DB_HOST || 'localhost';
const port = process.env.DB_PORT || 27017;
const db = process.env.DB_DATABASE || 'files_manager';

class DBClient {
  constructor() {
    this.conn = false;
    this.client = new MongoClient(`mongodb://${host}:${port}/${db}`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    this.connect();
  }

  async connect() {
    if (!this.conn) {
      try {
        await this.client.connect();
        this.db = this.client.db(db);
        this.files = this.db.collection('files');
        this.users = this.db.collection('users');
        this.conn = true;
      } catch (err) {
        console.error(err);
        throw new Error('Failed to connect to MongoDB');
      }
    }
  }

  isAlive() {
    return this.conn;
  }

  async nbUsers() {
    return this.users.countDocuments();
  }

  async nbFiles() {
    return this.files.countDocuments();
  }
}

const dbClient = new DBClient();
module.exports = dbClient;
