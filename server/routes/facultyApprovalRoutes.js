const express = require('express')
const { listAssignedApprovals, listFacultyDecisionHistory, decideLeaveRequest, downloadMyProof } = require('../controllers/leaveRequestController')

const router = express.Router()
router.get('/history', listFacultyDecisionHistory)
router.get('/:id/proof', downloadMyProof)
router.get('/', listAssignedApprovals)
router.post('/:id/decision', decideLeaveRequest)
module.exports = router
