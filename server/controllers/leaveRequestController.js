const LeaveRequest = require('../models/LeaveRequest')
const LeaveType = require('../models/LeaveType')
const User = require('../User')
const PDFDocument = require('pdfkit')
const mongoose = require('mongoose')

const approvalRoles = ['warden', 'counsellor', 'hod', 'joint_director']
const nextStage = { warden: 'counsellor', counsellor: 'hod', hod: 'joint_director', joint_director: null }
const allowedLeaveTypes = new Set(['Personal leave', 'Medical leave', 'Academic leave', 'Other'])
const requestLifetimeMs = 5 * 24 * 60 * 60 * 1000
const requestLifetimeDays = 5

async function deleteExpiredPendingRequests(filter = {}) {
  const now = new Date()
  const cutoff = new Date(now.getTime() - requestLifetimeMs)
  await LeaveRequest.deleteMany({
    ...filter,
    status: { $regex: '^pending_' },
    $or: [
      { expiresAt: { $lte: now } },
      { expiresAt: { $exists: false }, createdAt: { $lte: cutoff } },
      { expiresAt: null, createdAt: { $lte: cutoff } },
    ],
  })
}

function getStudentId(user) {
  return user?.id || user?._id || user?.userId || user?.sub
}

function makeReference(request) {
  return `LR-${request.createdAt.getFullYear()}-${request._id.toString().slice(-6).toUpperCase()}`
}

function serializeRequest(request) {
  return {
    id: request._id.toString(),
    reference: request.reference || makeReference(request),
    studentName: request.studentName,
    studentEmail: request.studentEmail,
    leaveType: request.leaveType,
    applicationType: request.applicationType || 'leave',
    destination: request.destination || '',
    leaveAddress: request.leaveAddress || '',
    contactNumber: request.contactNumber || '',
    startDate: request.startDate,
    endDate: request.endDate,
    reason: request.reason,
    departureTime: request.departureTime || '',
    returnTime: request.returnTime || '',
    history: request.history || [],
    studentResponse: request.studentResponse || null,
    attachment: request.attachment?.name ? { name: request.attachment.name, mime: request.attachment.mime, size: request.attachment.size } : null,
    priority: request.priority || 'normal',
    expiresAt: request.expiresAt || null,
    status: request.status,
    approvers: request.approvers || [],
    approvalHistory: request.approvalHistory || [],
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  }
}

async function listAvailableApprovers(_req, res, next) {
  try {
    const users = await User.find({ role: 'faculty', approvalRole: { $in: approvalRoles }, $or: [{ active: true }, { active: { $exists: false } }] })
      .select('name email approvalRole department')
      .sort({ name: 1 })
      .lean()
    const approvers = { warden: [], counsellor: [], hod: [], jointDirector: null }
    for (const user of users) {
      const option = { id: user._id.toString(), name: user.name, email: user.email, department: user.department || '' }
      if (user.approvalRole === 'joint_director') approvers.jointDirector = option
      else approvers[user.approvalRole]?.push(option)
    }
    res.json({ approvers })
  } catch (error) {
    next(error)
  }
}

async function listLeaveTypes(_req, res, next) {
  try {
    const records = await LeaveType.find({ active: true }).select('name').sort({ name: 1 }).lean()
    return res.json({ types: records.length ? records.map((item) => item.name) : [...allowedLeaveTypes] })
  } catch (error) { return next(error) }
}

function validProof(file) {
  const formats = {
    'application/pdf': ['pdf', (buffer) => buffer.subarray(0, 5).toString() === '%PDF-'],
    'image/png': ['png', (buffer) => buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))],
    'image/jpeg': ['jpg', (buffer) => buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255],
  }
  const format = formats[file.mimetype]
  const ext = file.originalname.split('.').pop().toLowerCase()
  return file.size <= 5 * 1024 * 1024 && format && (ext === format[0] || (format[0] === 'jpg' && ext === 'jpeg')) && format[1](file.buffer)
}

async function createLeaveRequest(req, res, next) {
  try {
    const { applicationType = 'leave', leaveType, startDate, endDate, reason, leaveAddress, departureTime, returnTime, destination, contactNumber, priority = 'normal' } = req.body
    let { approverIds = {} } = req.body
    if (typeof approverIds === 'string') {
      try { approverIds = JSON.parse(approverIds) } catch { return res.status(400).json({ message: 'Choose your approvers again.' }) }
    }
    const from = new Date(startDate)
    const to = new Date(endDate)
    if (!['leave', 'outpass'].includes(applicationType)) return res.status(400).json({ message: 'Choose leave or outpass.' })
    const records = await LeaveType.find({ active: true }).select('name').lean()
    const validTypes = records.length ? new Set(records.map((item) => item.name)) : allowedLeaveTypes
    if (applicationType === 'leave' && !validTypes.has(leaveType)) return res.status(400).json({ message: 'Choose a valid leave type.' })
    if (applicationType === 'outpass' && (from.toDateString() !== to.toDateString() || !/^([01]\d|2[0-3]):[0-5]\d$/.test(departureTime || '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(returnTime || '') || departureTime >= returnTime || typeof destination !== 'string' || !destination.trim() || destination.trim().length > 200 || typeof contactNumber !== 'string' || !/^\+?[\d ()-]{7,20}$/.test(contactNumber.trim()))) {
      return res.status(400).json({ message: 'Enter a same-day outpass with valid departure and return times, a destination, and a contact number.' })
    }
    if (typeof leaveAddress !== 'string' || !leaveAddress.trim() || leaveAddress.trim().length > 1000) return res.status(400).json({ message: 'Enter a leave address of up to 1000 characters.' })
    if (!['normal', 'urgent'].includes(priority)) return res.status(400).json({ message: 'Choose normal or urgent priority.' })
    if (!startDate || Number.isNaN(from.getTime()) || !endDate || Number.isNaN(to.getTime())) return res.status(400).json({ message: 'Enter valid start and end dates.' })
    if (to < from) return res.status(400).json({ message: 'The end date must be on or after the start date.' })
    if (from < new Date(new Date().setHours(0, 0, 0, 0))) return res.status(400).json({ message: 'Leave requests must start today or later.' })
    if (typeof reason !== 'string' || reason.trim().length < 8 || reason.trim().length > 2000) return res.status(400).json({ message: 'Reason must be between 8 and 2000 characters.' })

    const selectedRoles = applicationType === 'outpass' ? ['warden'] : ['warden', 'counsellor', 'hod']
    const selected = selectedRoles.map((role) => ({ role, id: String(approverIds[role] || '') }))
    if (selected.some(({ id }) => !mongoose.isValidObjectId(id))) return res.status(400).json({ message: applicationType === 'outpass' ? 'Choose a warden.' : 'Choose a warden, counsellor, and HOD.' })
    if (new Set(selected.map(({ id }) => id)).size !== selected.length) return res.status(400).json({ message: 'Choose a different approver for each role.' })

    const selectedUsers = await User.find({ _id: { $in: selected.map(({ id }) => id) }, role: 'faculty', $or: [{ active: true }, { active: { $exists: false } }] }).select('name email approvalRole department').lean()
    const assigned = selected.map(({ role, id }) => {
      const user = selectedUsers.find((candidate) => candidate._id.toString() === id && candidate.approvalRole === role)
      return user && { role, userId: user._id.toString(), name: user.name, email: user.email, department: user.department || '' }
    })
    if (assigned.some((approver) => !approver)) return res.status(400).json({ message: 'One or more selected approvers are no longer available. Refresh and choose again.' })

    if (applicationType === 'leave') {
      const jointDirector = await User.findOne({ role: 'faculty', approvalRole: 'joint_director', $or: [{ active: true }, { active: { $exists: false } }] }).select('name email department').lean()
      if (!jointDirector) return res.status(409).json({ message: 'The college has not configured its Joint Director account yet.' })
      assigned.push({ role: 'joint_director', userId: jointDirector._id.toString(), name: jointDirector.name, email: jointDirector.email, department: jointDirector.department || '' })
    }

    if (req.file && !validProof(req.file)) return res.status(400).json({ message: 'Proof must be a PDF, JPG or PNG up to 5 MB, with matching file contents.' })
    const timestamp = new Date()
    const safeName = req.file?.originalname.replace(/[\\/\0-\x1f]/g, '_').slice(0, 255)
    const request = await LeaveRequest.create({
      studentId: getStudentId(req.user).toString(),
      studentName: req.user.name || '',
      studentEmail: req.user.email || '',
      applicationType,
      leaveType: applicationType === 'outpass' ? 'Outpass' : leaveType,
      startDate: from,
      endDate: to,
      reason: reason.trim(),
      leaveAddress: leaveAddress.trim(),
      departureTime: applicationType === 'outpass' ? departureTime : undefined,
      returnTime: applicationType === 'outpass' ? returnTime : undefined,
      destination: applicationType === 'outpass' ? destination.trim() : '',
      contactNumber: applicationType === 'outpass' ? contactNumber.trim() : '',
      priority,
      approvers: assigned,
      expiresAt: new Date(timestamp.getTime() + requestLifetimeMs),
      history: [{ event: 'submitted', actorId: getStudentId(req.user).toString(), actorName: req.user.name || '', role: 'student', occurredAt: timestamp }],
      ...(req.file ? { attachment: { name: safeName, mime: req.file.mimetype, size: req.file.size, data: req.file.buffer } } : {}),
    })
    return res.status(201).json({ request: serializeRequest(request) })
  } catch (error) {
    return next(error)
  }
}

async function listMyLeaveRequests(req, res, next) {
  try {
    await deleteExpiredPendingRequests({ studentId: getStudentId(req.user).toString() })
    const requests = await LeaveRequest.find({ studentId: getStudentId(req.user).toString() }).select('-attachment.data').sort({ createdAt: -1 }).lean()
    return res.json({ requests: requests.map(serializeRequest) })
  } catch (error) {
    return next(error)
  }
}

async function getMyLeaveSummary(req, res, next) {
  try {
    const studentId = getStudentId(req.user).toString()
    await deleteExpiredPendingRequests({ studentId })
    const [total, pending, approved, rejected] = await Promise.all([
      LeaveRequest.countDocuments({ studentId }),
      LeaveRequest.countDocuments({ studentId, status: { $regex: '^pending_' } }),
      LeaveRequest.countDocuments({ studentId, status: 'approved' }),
      LeaveRequest.countDocuments({ studentId, status: 'rejected' }),
    ])
    return res.json({ total, pending, approved, rejected })
  } catch (error) {
    return next(error)
  }
}

async function listAssignedApprovals(req, res, next) {
  try {
    const role = req.user.approvalRole
    if (req.user.role !== 'faculty' || !approvalRoles.includes(role)) return res.status(403).json({ message: 'This faculty account is not assigned an approval role.' })
    await deleteExpiredPendingRequests()
    const requests = await LeaveRequest.find({
      status: `pending_${role}`,
      approvers: { $elemMatch: { role, userId: String(req.user.sub) } },
    }).select('-attachment.data').sort({ priority: -1, createdAt: 1 }).lean()
    return res.json({ requests: requests.map(serializeRequest) })
  } catch (error) {
    next(error)
  }
}

async function decideLeaveRequest(req, res, next) {
  try {
    const role = req.user.approvalRole
    if (req.user.role !== 'faculty' || !approvalRoles.includes(role)) return res.status(403).json({ message: 'This faculty account is not assigned an approval role.' })
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Leave request not found.' })
    const { decision, comment = '' } = req.body
    if (!['approved', 'rejected', 'needs_information'].includes(decision)) return res.status(400).json({ message: 'Choose approve, reject, or request more information.' })
    if (typeof comment !== 'string' || comment.trim().length > 1000) return res.status(400).json({ message: 'Comment must be 1000 characters or fewer.' })
    if (decision !== 'approved' && comment.trim().length < 3) return res.status(400).json({ message: 'Add a short note for the student.' })

    const approver = await User.findById(req.user.sub).select('name role approvalRole').lean()
    if (!approver || approver.role !== 'faculty' || approver.approvalRole !== role) return res.status(403).json({ message: 'This account is no longer assigned to that approval role.' })
    await deleteExpiredPendingRequests({ _id: req.params.id })
    const decisionAt = new Date()
    const fiveDaysAgo = new Date(decisionAt.getTime() - requestLifetimeDays * 24 * 60 * 60 * 1000)
    const isOutpass = (await LeaveRequest.findById(req.params.id).select('applicationType').lean())?.applicationType === 'outpass'
    const status = decision === 'needs_information' ? `pending_${role}` : decision === 'rejected' ? 'rejected' : isOutpass || !nextStage[role] ? 'approved' : `pending_${nextStage[role]}`
    const request = await LeaveRequest.findOneAndUpdate({
      _id: req.params.id,
      status: `pending_${role}`,
      approvers: { $elemMatch: { role, userId: String(req.user.sub) } },
      $or: [
        { expiresAt: { $gt: decisionAt } },
        { expiresAt: { $exists: false }, createdAt: { $gt: fiveDaysAgo } },
        { expiresAt: null, createdAt: { $gt: fiveDaysAgo } },
      ],
    }, {
      $set: { status, ...(status === 'approved' || status === 'rejected' ? { expiresAt: null } : {}) },
      ...(decision === 'needs_information' ? { $unset: { studentResponse: 1 } } : {}),
      $push: {
        approvalHistory: { role, approverId: String(req.user.sub), approverName: approver.name, decision, comment: comment.trim(), decidedAt: decisionAt },
        history: { event: decision, actorId: String(req.user.sub), actorName: approver.name, role, comment: comment.trim(), occurredAt: decisionAt },
      },
    }, { new: true, runValidators: true }).lean()

    if (!request) return res.status(409).json({ message: 'This request is no longer awaiting your decision.' })
    return res.json({ request: serializeRequest(request) })
  } catch (error) {
    next(error)
  }
}

async function listFacultyDecisionHistory(req, res, next) {
  try {
    const role = req.user.approvalRole
    if (req.user.role !== 'faculty' || !approvalRoles.includes(role)) return res.status(403).json({ message: 'This faculty account is not assigned an approval role.' })
    const requests = await LeaveRequest.find({ 'approvalHistory.approverId': String(req.user.sub) }).select('-attachment.data').sort({ updatedAt: -1 }).limit(100).lean()
    return res.json({ requests: requests.map((request) => ({ ...serializeRequest(request), myDecisions: (request.approvalHistory || []).filter((item) => item.approverId === String(req.user.sub)) })) })
  } catch (error) { return next(error) }
}

async function respondToInformationRequest(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Leave request not found.' })
    const message = req.body?.message
    if (typeof message !== 'string' || message.trim().length < 5 || message.trim().length > 1000) return res.status(400).json({ message: 'Your response must be between 5 and 1000 characters.' })
    const studentId = getStudentId(req.user).toString()
    const existing = await LeaveRequest.findOne({ _id: req.params.id, studentId }).select('status approvalHistory').lean()
    const latest = existing?.approvalHistory?.at(-1)
    if (!existing || !existing.status.startsWith('pending_') || latest?.decision !== 'needs_information') return res.status(409).json({ message: 'This request is not waiting for more information from you.' })
    const timestamp = new Date()
    const request = await LeaveRequest.findOneAndUpdate({
      _id: req.params.id,
      studentId,
      status: existing.status,
      'approvalHistory.0': { $exists: true },
    }, {
      $set: { studentResponse: { message: message.trim(), respondedAt: timestamp } },
      $push: { history: { event: 'student_response', actorId: studentId, actorName: req.user.name || '', role: 'student', comment: message.trim(), occurredAt: timestamp } },
    }, { new: true, runValidators: true }).select('-attachment.data').lean()
    if (!request) return res.status(409).json({ message: 'This request changed. Reload and try again.' })
    return res.json({ request: serializeRequest(request) })
  } catch (error) { return next(error) }
}

async function cancelMyLeaveRequest(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Leave request not found.' })
    const studentId = getStudentId(req.user).toString()
    const timestamp = new Date()
    const request = await LeaveRequest.findOneAndUpdate({
      _id: req.params.id,
      studentId,
      status: 'pending_warden',
      'approvalHistory.0': { $exists: false },
    }, {
      $set: { status: 'cancelled', expiresAt: null },
      $push: { history: { event: 'cancelled', actorId: studentId, actorName: req.user.name || '', role: 'student', occurredAt: timestamp } },
    }, { new: true, runValidators: true }).select('-attachment.data').lean()
    if (!request) return res.status(409).json({ message: 'A request can only be cancelled before its first approver records a decision.' })
    return res.json({ request: serializeRequest(request) })
  } catch (error) { return next(error) }
}

async function downloadMyProof(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Proof file not found.' })
    const request = await LeaveRequest.findById(req.params.id).select('studentId approvers attachment').lean()
    const ownsRequest = req.user.role === 'student' && request?.studentId === getStudentId(req.user).toString()
    const assignedFaculty = req.user.role === 'faculty' && request?.approvers?.some((person) => person.userId === String(req.user.sub))
    if (!ownsRequest && !assignedFaculty) return res.status(404).json({ message: 'Proof file not found.' })
    if (!request?.attachment?.data) return res.status(404).json({ message: 'Proof file not found.' })
    const extensions = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' }
    res.set({ 'Content-Type': request.attachment.mime, 'Content-Disposition': `attachment; filename="proof.${extensions[request.attachment.mime]}"`, 'Cache-Control': 'no-store' })
    return res.send(request.attachment.data)
  } catch (error) { return next(error) }
}

function formatTimestamp(value) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata',
  }).format(new Date(value)) + ' IST'
}

async function downloadApprovedLetter(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Leave request not found.' })
    const studentId = getStudentId(req.user).toString()
    const request = await LeaveRequest.findOne({ _id: req.params.id, studentId }).lean()
    if (!request) return res.status(404).json({ message: 'Leave request not found.' })
    const requiredRoles = request.applicationType === 'outpass' ? ['warden'] : approvalRoles
    const completedApprovals = new Map((request.approvalHistory || []).filter((item) => item.decision === 'approved' && item.decidedAt).map((item) => [item.role, item]))
    if (request.status !== 'approved' || requiredRoles.some((role) => !completedApprovals.has(role))) {
      return res.status(409).json({ message: `The approval letter is available after ${requiredRoles.length === 1 ? 'the Warden approves' : 'all four approvals are complete'}.` })
    }

    const reference = makeReference(request)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${reference}.pdf"`)
    const pdf = new PDFDocument({ size: 'A4', margin: 58, info: { Title: `Leave approval ${reference}`, Author: 'Campus Leave' } })
    pdf.pipe(res)
    pdf.fontSize(20).fillColor('#245c42').text('CAMPUS LEAVE')
    pdf.moveDown().fontSize(10).fillColor('#66736b').text(request.applicationType === 'outpass' ? 'STUDENT OUTPASS APPROVAL' : 'STUDENT LEAVE APPROVAL')
    pdf.moveDown().fontSize(18).fillColor('#202b24').text(request.applicationType === 'outpass' ? 'Outpass approval letter' : 'Leave approval letter')
    pdf.moveDown().fontSize(10).text(`Reference: ${reference}`)
    pdf.moveDown().fontSize(11).fillColor('#202b24').text(`Student: ${request.studentName || 'Student'}`)
    if (request.studentEmail) pdf.text(`College email: ${request.studentEmail}`)
    pdf.moveDown().font('Helvetica-Bold').text('Leave type: ', { continued: true }).font('Helvetica').text(request.leaveType)
    pdf.font('Helvetica-Bold').text('Start date: ', { continued: true }).font('Helvetica').text(new Date(request.startDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }))
    pdf.font('Helvetica-Bold').text('End date: ', { continued: true }).font('Helvetica').text(new Date(request.endDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }))
    if (request.applicationType === 'outpass') {
      pdf.font('Helvetica-Bold').text('Departure / return: ', { continued: true }).font('Helvetica').text(`${request.departureTime} – ${request.returnTime}`)
      pdf.font('Helvetica-Bold').text('Destination: ', { continued: true }).font('Helvetica').text(request.destination)
      pdf.font('Helvetica-Bold').text('Contact: ', { continued: true }).font('Helvetica').text(request.contactNumber)
    }
    pdf.font('Helvetica-Bold').text('Priority: ', { continued: true }).font('Helvetica').text(request.priority === 'urgent' ? 'Urgent' : 'Normal')
    if (request.leaveAddress) pdf.font('Helvetica-Bold').text('Leave address: ', { continued: true }).font('Helvetica').text(request.leaveAddress)
    pdf.font('Helvetica-Bold').text('Reason: ', { continued: true }).font('Helvetica').text(request.reason)
    pdf.moveDown().font('Helvetica-Bold').fontSize(12).text('Approval record')
    for (const role of requiredRoles) {
      const approval = completedApprovals.get(role)
      const assigned = request.approvers.find((item) => item.role === role)
      pdf.moveDown(0.5).font('Helvetica-Bold').fontSize(10).text(`${role.replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}: `, { continued: true })
      pdf.font('Helvetica').text(`${approval?.approverName || assigned?.name || 'Approver'} — Approved ${formatTimestamp(approval.decidedAt)}`)
    }
    pdf.moveDown(1.5).fontSize(9).fillColor('#7b8780').text('Generated electronically by the Campus Leave system.')
    pdf.end()
  } catch (error) {
    next(error)
  }
}

module.exports = {
  listAvailableApprovers,
  listLeaveTypes,
  createLeaveRequest,
  listMyLeaveRequests,
  getMyLeaveSummary,
  listAssignedApprovals,
  listFacultyDecisionHistory,
  decideLeaveRequest,
  cancelMyLeaveRequest,
  respondToInformationRequest,
  downloadMyProof,
  downloadApprovedLetter,
}
