const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  user_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['COUNSELOR', 'HOD', 'WARDEN', 'DIRECTOR'], required: true },
  department: { type: String, required: true },
  active: { type: Boolean, default: true },
  contact_email: { type: String, required: true, unique: true },
});
module.exports = mongoose.model('Approver', schema);
