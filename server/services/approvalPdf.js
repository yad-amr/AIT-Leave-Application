const PDFDocument = require('pdfkit')

const roleLabels = { warden: 'Warden', counsellor: 'Counsellor', hod: 'Head of Department', joint_director: 'Joint Director' }
const date = (value) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(new Date(value))
const timestamp = (value) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(value)) + ' IST'

function createApprovalPdf(request, reference, requiredRoles, completedApprovals) {
  const outpass = request.applicationType === 'outpass'
  const title = outpass ? 'Outpass approval' : 'Leave approval'
  const pdf = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36, info: { Title: `${title} ${reference}`, Author: 'Campus Leave' } })
  const width = pdf.page.width - 72
  const table = (headers, rows, columns) => {
    pdf.font('Helvetica').fontSize(10)
    pdf.table({
      position: { x: 36 },
      columnStyles: columns,
      defaultStyle: { padding: 7, border: .5, borderColor: '#cbd8cf', textColor: '#20332e', font: { size: 10 } },
      rowStyles: (index) => index === 0
        ? { backgroundColor: '#e4eee7', font: { src: 'Helvetica-Bold' } }
        : { backgroundColor: index % 2 ? '#ffffff' : '#f5f8f5' },
      data: [headers.map((text) => ({ text, type: 'TH' })), ...rows],
    })
    pdf.x = 36
    pdf.moveDown(.7)
  }
  const section = (text) => {
    if (pdf.y > pdf.page.height - 110) pdf.addPage()
    pdf.font('Helvetica-Bold').fontSize(12).fillColor('#245c42').text(text, 36, pdf.y)
    pdf.moveDown(.4)
  }

  pdf.font('Helvetica-Bold').fontSize(20).fillColor('#245c42').text('CAMPUS LEAVE')
  pdf.fontSize(17).fillColor('#20332e').text(`${title.toUpperCase()} | APPROVED`)
  pdf.font('Helvetica').fontSize(10).text(`Application reference: ${reference}`)
  pdf.moveDown(.5).fontSize(11).text(outpass
    ? 'This outpass has been approved by the Warden for the departure and expected return shown below.'
    : 'This leave application has received all four required approvals for the period shown below.')
  pdf.moveDown(.7)
  section('Student and application details')
  table(['Information', 'Details', 'Information', 'Details'], [
    ['Student name', request.studentName || 'Not provided', 'College email', request.studentEmail || 'Not provided'],
    ['Application type', outpass ? 'Outpass' : 'Leave', 'Priority', request.priority === 'urgent' ? 'Urgent' : 'Normal'],
    [outpass ? 'Departure date' : 'Leave starts', date(request.startDate), outpass ? 'Return date' : 'Leave ends (inclusive)', date(request.endDate)],
    ...(outpass ? [['Departure time (IST)', request.departureTime || 'Not provided', 'Expected return time (IST)', request.returnTime || 'Not provided']] : [['Leave category', request.leaveType || 'Not provided', 'Date convention', 'Both start and end dates are included']]),
    ['Student contact number', request.contactNumber || 'Not provided', 'Approval status', 'Approved'],
  ], [125, width / 2 - 125, 125, width / 2 - 125])
  table(['Information', 'Details'], [
    ['Reason for request', request.reason || 'Not provided'],
    [outpass ? 'Destination / address' : 'Address during leave', request.leaveAddress || 'Not provided'],
  ], [150, width - 150])
  section('Approval record')
  table(['Approving authority', 'Approved by', 'Decision', 'Decision date and time (IST)'], requiredRoles.map((role) => {
    const approval = completedApprovals.get(role)
    const assigned = (request.approvers || []).find((person) => person.role === role)
    return [roleLabels[role] || role, approval.approverName || assigned?.name || 'Approver', 'Approved', timestamp(approval.decidedAt)]
  }), [160, width - 440, 90, 190])
  pdf.font('Helvetica').fontSize(9).fillColor('#46574c').text('All dates and times use Indian Standard Time (IST). The approval record lists the recorded decisions of the required authorities. Generated electronically by the Campus Leave system.', 36, pdf.y, { width })
  return pdf
}

module.exports = { createApprovalPdf }
