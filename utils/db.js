import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    this.host = process.env.DB_HOST || 'localhost';
    this.port = process.env.DB_PORT || 27017;
    this.database = process.env.DB_DATABASE || 'files_manager';
    this.client = new MongoClient(`mongodb://${this.host}:${this.port}`, {
      useUnifiedTopology: true,
    });
    // this.client.connect();
    this.connect();
  }

  async connect() {
    try {
      await this.client.connect();
      this.db = this.client.db(this.database);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  }

  isAlive() {
    return this.client.isConnected();
  }

  async nbUsers() {
    return this.db.collection('users').countDocuments();
  }

  async nbFiles() {
    const count = await this.db.collection('files').countDocuments();
    return count;
  }
}

export const dbClient = new DBClient();
export default dbClient;
