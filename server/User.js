const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  email: { type: String, unique: true, required: true, lowercase: true, trim: true },
  role: { type: String, enum: ['student', 'faculty'], required: true },
  approval_role: { type: String, enum: ['warden', 'counsellor', 'hod', 'joint_director'] },
  name: { type: String, required: true },
  approver_role: { type: String, enum: ['class_teacher', 'hod', 'warden', 'director'] },
  college_id: { type: String, required: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: false }, toJSON: { virtuals: true } });
module.exports = mongoose.model('User', schema);
