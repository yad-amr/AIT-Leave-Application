const mongoose = require('mongoose')

const leaveTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, unique: true, maxlength: 100 },
  active: { type: Boolean, default: true, index: true },
}, { timestamps: true })

module.exports = mongoose.models.LeaveType || mongoose.model('LeaveType', leaveTypeSchema)
