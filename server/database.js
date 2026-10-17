const mongoose = require('mongoose');

async function removeLegacyLeaveRequestExpiryIndex() {
  const collectionName = 'leaverequests'
  const collections = await mongoose.connection.db.listCollections({ name: collectionName }, { nameOnly: true }).toArray()
  if (!collections.length) return

  const collection = mongoose.connection.db.collection(collectionName)
  const indexes = await collection.indexes()
  const expiryIndex = indexes.find((index) => index.key?.expiresAt === 1 && index.expireAfterSeconds !== undefined)
  if (expiryIndex) await collection.dropIndex(expiryIndex.name)
}

module.exports = async function connect(uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/leave_management') {
  await mongoose.connect(uri)
  await removeLegacyLeaveRequestExpiryIndex()
};
