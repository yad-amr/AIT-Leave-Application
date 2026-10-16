const mongoose = require('mongoose')
const approvalRoles = ['warden', 'counsellor', 'hod', 'joint_director']

const approvalHistorySchema = new mongoose.Schema({
  role: { type: String, enum: approvalRoles, required: true },
  approverId: { type: String, required: true },
  approverName: { type: String, required: true },
  decision: { type: String, enum: ['approved', 'rejected', 'needs_information'], required: true },
  comment: { type: String, trim: true, maxlength: 1000, default: '' },
  decidedAt: { type: Date, required: true },
}, { _id: false })

const assignedApproverSchema = new mongoose.Schema({
  role: { type: String, enum: approvalRoles, required: true },
  userId: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  department: { type: String, trim: true, default: '' },
}, { _id: false })

const activitySchema = new mongoose.Schema({
  event: { type: String, enum: ['submitted', 'approved', 'rejected', 'needs_information', 'student_response', 'cancelled'], required: true },
  actorId: { type: String, required: true },
  actorName: { type: String, default: '' },
  role: { type: String, enum: [...approvalRoles, 'student'], required: true },
  comment: { type: String, trim: true, maxlength: 1000, default: '' },
  occurredAt: { type: Date, required: true },
}, { _id: false })

const leaveRequestSchema = new mongoose.Schema({
  studentId: { type: String, required: true, index: true },
  studentName: { type: String, default: '', trim: true },
  studentEmail: { type: String, default: '', trim: true, lowercase: true },
  applicationType: { type: String, enum: ['leave', 'outpass'], default: 'leave', required: true },
  leaveType: { type: String, required: true, trim: true, maxlength: 100 },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  reason: { type: String, required: true, trim: true, minlength: 8, maxlength: 2000 },
  departureTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  returnTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  destination: { type: String, trim: true, maxlength: 200, default: '' },
  contactNumber: { type: String, trim: true, maxlength: 20, default: '' },
  priority: { type: String, enum: ['normal', 'urgent'], default: 'normal', required: true },
  attachment: { name: { type: String, trim: true, maxlength: 255 }, mime: { type: String, enum: ['application/pdf', 'image/jpeg', 'image/png'] }, size: { type: Number, max: 5242880 }, data: Buffer },
  history: { type: [activitySchema], default: [] },
  studentResponse: { message: { type: String, trim: true, maxlength: 1000 }, respondedAt: Date },
  approvers: { type: [assignedApproverSchema], required: true, validate: {
    validator(items) {
      const requiredRoles = this.applicationType === 'outpass' ? ['warden'] : approvalRoles
      return items.length === requiredRoles.length && requiredRoles.every((role) => items.some((item) => item.role === role))
    },
    message: 'The approver list must match the application type.',
  } },
  expiresAt: { type: Date, default: null },
  status: {
    type: String,
    enum: ['pending_warden', 'pending_counsellor', 'pending_hod', 'pending_joint_director', 'approved', 'rejected', 'cancelled'],
    default: 'pending_warden',
    index: true,
  },
  approvalHistory: { type: [approvalHistorySchema], default: [] },
}, { timestamps: true })

leaveRequestSchema.index({ studentId: 1, createdAt: -1 })
leaveRequestSchema.index({ status: 1, 'approvers.userId': 1 })
leaveRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { expiresAt: { $type: 'date' } } })

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema)
