const express = require('express')
const multer = require('multer')
const {
  listAvailableApprovers,
  listLeaveTypes,
  createLeaveRequest,
  listMyLeaveRequests,
  getMyLeaveSummary,
  downloadApprovedLetter,
  downloadMyProof,
  cancelMyLeaveRequest,
  respondToInformationRequest,
} = require('../controllers/leaveRequestController')
const { requireStudent } = require('../middleware/requireStudent')

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 12, fieldSize: 4096 } }).single('proof')
router.use(requireStudent)
router.get('/approvers', listAvailableApprovers)
router.get('/leave-types', listLeaveTypes)
router.get('/summary', getMyLeaveSummary)
router.get('/:id/pdf', downloadApprovedLetter)
router.get('/:id/proof', downloadMyProof)
router.post('/:id/cancel', cancelMyLeaveRequest)
router.post('/:id/respond', respondToInformationRequest)
router.get('/', listMyLeaveRequests)
router.post('/', upload, createLeaveRequest)
module.exports = router
