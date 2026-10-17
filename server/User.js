const mongoose = require('mongoose')

const approvalRoles = ['warden', 'counsellor', 'hod', 'joint_director']
const legacyApprovalRoles = ['class_teacher', 'hod', 'warden', 'director']
const schema = new mongoose.Schema({
  email: { type: String, unique: true, required: true, lowercase: true, trim: true },
  role: { type: String, enum: ['student', 'faculty', 'warden'], required: true },
  approvalRole: { type: String, enum: approvalRoles, default: undefined },
  // Temporary compatibility for records created by the original OTP and contributor-branch seeders.
  approval_role: { type: String, enum: [...approvalRoles, ...legacyApprovalRoles], select: false },
  approver_role: { type: String, enum: [...approvalRoles, ...legacyApprovalRoles], select: false },
  name: { type: String, required: true },
  approver_role: { type: String, enum: ['class_teacher', 'hod', 'warden', 'director'] },
  college_id: { type: String, required: true },
  department: { type: String, trim: true, default: '' },
  active: { type: Boolean, default: true },
  passwordHash: { type: String, required: true, select: false },
}, { timestamps: { createdAt: 'created_at', updatedAt: false }, toJSON: { virtuals: true } })

schema.index({ approvalRole: 1 }, { unique: true, partialFilterExpression: { approvalRole: 'joint_director' } })

schema.statics.migrateLegacyApproverRoles = async function migrateLegacyApproverRoles() {
  const mapping = { class_teacher: 'counsellor', director: 'joint_director' }
  const legacyUsers = await this.find({ $or: [{ approval_role: { $exists: true } }, { approver_role: { $exists: true } }, { role: 'warden' }] })
    .select('+approval_role +approver_role')
    .lean()
  for (const user of legacyUsers) {
    const legacyRole = user.approver_role || user.approval_role
    const approvalRole = mapping[legacyRole] || legacyRole || (user.role === 'warden' ? 'warden' : undefined)
    await this.updateOne({ _id: user._id }, {
      ...(approvalRole && approvalRoles.includes(approvalRole) ? { $set: { approvalRole, role: user.role === 'warden' ? 'faculty' : user.role } } : {}),
      $unset: { approval_role: 1, approver_role: 1 },
    }, { strict: false })
  }
}

module.exports = mongoose.model('User', schema)
