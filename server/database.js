const mongoose = require('mongoose');
module.exports = async function connect() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/leave_management'
  await mongoose.connect(uri)
};
