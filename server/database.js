const mongoose = require('mongoose');
module.exports = async function connect() {
  if (process.env.MONGODB_URI) { await mongoose.connect(process.env.MONGODB_URI); return; }
  if (process.env.DEV_MODE !== 'true' || process.env.NODE_ENV === 'production') throw new Error('MONGODB_URI is required outside local dev mode.');
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri());
};
