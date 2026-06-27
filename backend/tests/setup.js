/**
 * @file tests/setup.js
 * @description Jest global setup – spins up a MongoMemoryServer so tests
 *              never touch a real database.
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose              = require('mongoose');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri   = mongoServer.getUri();
  process.env.MONGODB_URI = uri;
  process.env.NODE_ENV    = 'test';
  process.env.JWT_ACCESS_SECRET  = 'test_access_secret_32chars_minimum_';
  process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_32chars_minimum';
  process.env.JWT_ACCESS_EXPIRES_IN  = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.BCRYPT_SALT_ROUNDS = '4'; // fast for tests
  process.env.PORT = '5099';

  await mongoose.connect(uri, { dbName: 'synccode_test' });
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongoServer.stop();
});

afterEach(async () => {
  // Clean all collections between tests for isolation
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});
