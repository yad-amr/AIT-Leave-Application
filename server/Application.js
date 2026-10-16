const mongoose = require('mongoose');
const step = new mongoose.Schema({ order: Number, role: String, approver_id: String, decision: String, signature_data: String, comment: String, decided_at: Date }, { _id: false });
const schema = new mongoose.Schema({
  student_id: { type: String, required: true, index: true }, type: { type: String, enum: ['LEAVE', 'OUTPASS'], required: true },
  status: { type: String, enum: ['DRAFT','SUBMITTED','IN_REVIEW','APPROVED','REJECTED','CANCELLED'], default: 'SUBMITTED' },
  is_urgent: Boolean, fields: mongoose.Schema.Types.Mixed,
  attachment: { name: String, mime: String, size: Number, data: Buffer }, steps: [step],
  history: [{ event: String, actor_id: String, timestamp: Date }], revision: { type: Number, default: 0 },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
module.exports = mongoose.model('Application', schema);
module.exports.LeaveType = mongoose.model('LeaveType', new mongoose.Schema({ name: { type: String, unique: true }, active: { type: Boolean, default: true } }));
