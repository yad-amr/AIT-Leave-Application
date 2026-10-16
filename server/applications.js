const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const Application = require('./Application');
const Approver = require('./Approver');
const DIRECTORY_ROLES = { class_teacher: 'COUNSELOR', hod: 'HOD', warden: 'WARDEN', director: 'DIRECTOR' };
const { LeaveType } = Application;
const CHAINS = { LEAVE: ['class_teacher', 'hod', 'warden', 'director'], OUTPASS: ['warden'] };
const clean = value => typeof value === 'string' ? value.replace(/<[^>]*>/g, '').replace(/[\u0000-\u0008]/g, '').trim() : '';
const fail = message => Object.assign(new Error(message), { status: 400 });
function validate(type, body, leaveTypes) {
  const fields = { reason: clean(body.reason) };
  if (fields.reason.length < 10 || fields.reason.length > 2000) throw fail('Reason must contain 10–2000 characters.');
  const date = (key, time = false) => { const value = clean(body[key]); if (!(time ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/ : /^\d{4}-\d{2}-\d{2}$/).test(value) || !Number.isFinite(Date.parse(value)) || (!time && new Date(value).toISOString().slice(0,10) !== value)) throw fail('Enter valid dates and times.'); fields[key] = value; return Date.parse(value); };
  if (type === 'LEAVE') {
    fields.leave_type = clean(body.leave_type);
    if (!leaveTypes.includes(fields.leave_type)) throw fail('Select a valid leave type.');
    const start = date('from_date'), end = date('to_date');
    if (end < start) throw fail('To date must not precede from date.');
    fields.days = (end - start) / 86400000 + 1;
  } else {
    if (date('return_at', true) <= date('out_at', true)) throw fail('Return must be after departure.');
    fields.destination = clean(body.destination); fields.contact = clean(body.contact);
    if (!fields.destination || fields.destination.length > 200 || !/^\+?[\d ()-]{7,20}$/.test(fields.contact)) throw fail('Enter a destination and valid contact number.');
  }
  if (![undefined, true, false, 'true', 'false'].includes(body.is_urgent)) throw fail('Invalid urgent flag.');
  return fields;
}
function validateFile(file) {
  if (!file) return;
  const formats = { 'application/pdf': ['pdf', b => b.subarray(0,5).toString() === '%PDF-'], 'image/png': ['png', b => b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))], 'image/jpeg': ['jpg', b => b[0] === 255 && b[1] === 216 && b[2] === 255] };
  const format = formats[file.mimetype], ext = file.originalname.split('.').pop().toLowerCase();
  if (file.size > 5 * 1024 * 1024 || !format || !(ext === format[0] || (format[0] === 'jpg' && ext === 'jpeg')) || !format[1](file.buffer)) throw fail('Proof must be a PDF, JPG or PNG up to 5 MB, with matching file contents.');
}
function decide(app, user, body) {
  if (!['SUBMITTED','IN_REVIEW'].includes(app.status)) throw fail('This application is closed.');
  const step = app.steps.find(s => !s.decision);
  if (step.role !== user.approver_role || !step.approver_user_id || step.approver_user_id !== user.sub) throw Object.assign(new Error('Only the assigned approver can sign the current step.'), { status: 403 });
  if (!['APPROVED','REJECTED'].includes(body.decision)) throw fail('Choose APPROVED or REJECTED.');
  const signature = clean(body.signature_data), comment = clean(body.comment);
  if (signature.length < 2 || signature.length > 150) throw fail('A typed signature of 2–150 characters is required.');
  if (comment.length > 2000 || (body.decision === 'REJECTED' && comment.length < 3)) throw fail('A rejection reason is required (maximum 2000 characters).');
  Object.assign(step, { decision: body.decision, signature_data: signature, comment, decided_at: new Date() });
  app.status = body.decision === 'REJECTED' ? 'REJECTED' : app.steps.every(s => s.decision === 'APPROVED') ? 'APPROVED' : 'IN_REVIEW';
  app.history.push({ event: `${step.role}: ${body.decision}`, actor_id: user.sub, timestamp: new Date() });
}
function present(doc) { const value = doc.toObject(); if (value.attachment?.data) delete value.attachment.data; value.id = String(value._id); value.current_step = ['SUBMITTED','IN_REVIEW'].includes(value.status) ? value.steps.find(s => !s.decision)?.role : null; return value; }
function routes(authenticated) {
  const router = express.Router(); router.use(authenticated);
  const student = (req,res,next) => req.user.role === 'student' ? next() : res.status(403).json({ error: 'Student access required.' });
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 12, fieldSize: 4096 } }).single('proof');
  router.get('/approvers', student, async (req,res) => {
    const role = req.query.role;
    if (role !== undefined && !Object.values(DIRECTORY_ROLES).includes(role)) throw fail('Select a valid approver role.');
    const records = await Approver.find({ active: true, ...(role ? { role } : {}) }).select('name role department').sort({ name: 1 });
    res.json({ approvers: records.map(a => ({ id: String(a._id), name: a.name, role: a.role, department: a.department })) });
  });
  router.get('/leave-types', student, async (req,res) => res.json({ types: (await LeaveType.find({ active: true })).map(t => t.name) }));
  router.get('/home/summary', student, async (req,res) => {
    const all = await Application.find({ student_id: req.user.sub }).select('-attachment.data').sort({ is_urgent: -1, created_at: -1 });
    const counts = Object.fromEntries(['DRAFT','SUBMITTED','IN_REVIEW','APPROVED','REJECTED','CANCELLED'].map(s => [s, all.filter(a => a.status === s).length]));
    res.json({ counts, urgent: all.filter(a => a.is_urgent && ['SUBMITTED','IN_REVIEW'].includes(a.status)).map(present), recent: all.slice(0,6).map(present) });
  });
  const submissionLimit = rateLimit({ windowMs: 15*60000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many submissions. Try again in 15 minutes.' } });
  for (const type of Object.keys(CHAINS)) router.post(`/applications/${type.toLowerCase()}`, student, submissionLimit, ...(type === 'LEAVE' ? [upload] : []), async (req,res) => {
    const fields = validate(type, req.body, (await LeaveType.find({ active: true })).map(t => t.name)); validateFile(req.file);
    const selectedRoles = CHAINS[type].filter(role => role !== 'director');
    const allowedFields = selectedRoles.map(role => `${role}_id`);
    if (Object.keys(req.body).some(key => key.endsWith('_id') && !allowedFields.includes(key))) throw fail('Unexpected approver selection.');
    const steps = [];
    for (const [i, role] of CHAINS[type].entries()) {
      let approver;
      if (role === 'director') {
        const directors = await Approver.find({ role: 'DIRECTOR', active: true });
        if (directors.length !== 1) throw fail('Exactly one active director must be configured.');
        approver = directors[0];
      } else {
        const id = req.body[`${role}_id`];
        if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) throw fail(`Select a valid ${DIRECTORY_ROLES[role].toLowerCase()}.`);
        approver = await Approver.findOne({ _id: id, role: DIRECTORY_ROLES[role], active: true });
        if (!approver) throw fail('Selected approver is inactive or has the wrong role.');
      }
      steps.push({ role, order: i + 1, approver_id: String(approver._id), approver_user_id: approver.user_id, approver_name: approver.name, department: approver.department });
    }
    const file = req.file;
    const app = await Application.create({ student_id: req.user.sub, type, fields, is_urgent: req.body.is_urgent === true || req.body.is_urgent === 'true', steps, history: [{ event: 'SUBMITTED', actor_id: req.user.sub, timestamp: new Date() }], ...(file ? { attachment: { name: clean(file.originalname), mime: file.mimetype, size: file.size, data: file.buffer } } : {}) });
    res.status(201).json(present(app));
  });
  router.get('/applications', student, async (req,res) => {
    const filter = { student_id: req.user.sub };
    for (const key of ['type','status']) if (req.query[key]) { if (typeof req.query[key] !== 'string') throw fail('Invalid filter.'); filter[key] = req.query[key]; }
    if (req.query.urgent !== undefined) { if (!['true','false'].includes(req.query.urgent)) throw fail('Invalid urgent filter.'); filter.is_urgent = req.query.urgent === 'true'; }
    res.json({ applications: (await Application.find(filter).select('-attachment.data').sort({ is_urgent: -1, created_at: -1 })).map(present) });
  });
  router.param('id', async (req,res,next,id) => {
    if (!/^[a-f\d]{24}$/i.test(id)) return res.status(404).json({ error: 'Application not found.' });
    req.application = await Application.findById(id);
    if (!req.application || (req.user.role === 'student' && req.application.student_id !== req.user.sub)) return res.status(404).json({ error: 'Application not found.' });
    next();
  });
  router.get('/applications/:id', student, (req,res) => res.json(present(req.application)));
  router.get('/applications/:id/proof', student, (req,res) => { const file = req.application.attachment; if (!file?.data) return res.sendStatus(404); res.set({ 'Content-Type': file.mime, 'Content-Disposition': 'attachment; filename="proof.' + (file.mime === 'application/pdf' ? 'pdf' : file.mime === 'image/png' ? 'png' : 'jpg') + '"', 'Cache-Control': 'no-store' }).send(file.data); });
  async function save(req,res) { const app = req.application; const revision = app.revision; app.revision++; const value = app.toObject(); delete value._id; delete value.__v; const result = await Application.updateOne({ _id: app._id, revision }, { $set: value }); if (!result.modifiedCount) return res.status(409).json({ error: 'Application changed. Reload and try again.' }); res.json(present(app)); }
  router.post('/applications/:id/cancel', student, async (req,res) => { const app = req.application; if (!['SUBMITTED','DRAFT'].includes(app.status) || app.steps.some(s => s.decision)) throw fail('Cancellation is only allowed before the first approval.'); app.status = 'CANCELLED'; app.history.push({ event: 'CANCELLED', actor_id: req.user.sub, timestamp: new Date() }); await save(req,res); });
  router.post('/applications/:id/approvals', async (req,res) => { if (!req.user.approver_role || req.user.role === 'student') return res.status(403).json({ error: 'Approver access required.' }); const step = req.application.steps.find(s => !s.decision); if (!step || !await Approver.exists({ _id: step.approver_id, user_id: req.user.sub, active: true, role: DIRECTORY_ROLES[step.role] })) return res.status(403).json({ error: 'Only the active assigned approver can sign.' }); decide(req.application,req.user,req.body); await save(req,res); });
  router.use((error,req,res,next) => { if (error instanceof multer.MulterError) return res.status(400).json({ error: 'Upload one PDF, JPG or PNG up to 5 MB.' }); if (error.status) return res.status(error.status).json({ error: error.message }); next(error); });
  return router;
}
module.exports = { routes, validate, validateFile, decide, CHAINS };
