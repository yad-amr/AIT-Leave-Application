const mongoose = require('mongoose');

const approvalRoles = ['warden', 'counsellor', 'hod', 'joint_director'];
const eventSchema = new mongoose.Schema({
  action: { type: String, enum: ['submitted', 'approved', 'rejected', 'needs_information'], required: true },
  role: { type: String, enum: approvalRoles },
  actorName: { type: String, required: true },
  actorEmail: { type: String, required: true },
  note: { type: String, default: '' },
  signature: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const schema = new mongoose.Schema({
  token: { type: String, unique: true, required: true },
  studentEmail: { type: String, required: true, index: true },
  studentName: { type: String, required: true },
  leaveType: { type: String, enum: ['Hostel leave', 'Academic outpass'], required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  destination: { type: String, required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  currentStage: { type: String, enum: [...approvalRoles, null], default: approvalRoles[0], index: true },
  timeline: { type: [eventSchema], default: [] },
}, { timestamps: true, optimisticConcurrency: true });

module.exports = mongoose.model('LeaveRequest', schema);
