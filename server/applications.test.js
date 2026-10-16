const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const { createApp } = require('./auth');
const { validate, validateFile, decide, CHAINS } = require('./applications');
const Application = require('./Application');
test('validation requires reason, accepts optional proof and rejects invalid files and dates', () => {
  const fields = { reason: 'A family appointment', leave_type: 'Personal', from_date: '2026-10-20', to_date: '2026-10-21' };
  assert.equal(validate('LEAVE', fields, ['Personal']).days, 2);
  assert.doesNotThrow(() => validateFile());
  assert.throws(() => validate('LEAVE', { ...fields, reason: '' }, ['Personal']));
  assert.throws(() => validate('LEAVE', { ...fields, to_date: '2026-10-19' }, ['Personal']));
  for (const file of [{ originalname: 'a.exe', mimetype: 'application/pdf', buffer: Buffer.from('%PDF-'), size: 5 }, { originalname: 'a.pdf', mimetype: 'application/pdf', buffer: Buffer.from('fake'), size: 4 }, { originalname: 'a.pdf', mimetype: 'application/pdf', buffer: Buffer.from('%PDF-'), size: 6*1024*1024 }]) assert.throws(() => validateFile(file));
});
test('rejection at each leave step stops the chain and records the reason', () => {
  for (let reject = 0; reject < 4; reject++) {
    const app = { status: 'SUBMITTED', steps: CHAINS.LEAVE.map(role => ({ role })), history: [] };
    for (let i=0; i<=reject; i++) decide(app, { sub: 'signer', approver_role: CHAINS.LEAVE[i] }, { decision: i === reject ? 'REJECTED' : 'APPROVED', signature_data: 'Demo Signer', comment: 'Cannot approve dates' });
    assert.equal(app.status,'REJECTED'); assert.equal(app.steps[reject].comment,'Cannot approve dates');
    assert.throws(() => decide(app, { sub: 'signer', approver_role: 'director' }, { decision: 'APPROVED', signature_data: 'Signer' }));
  }
});
test('API: sequential approvals, ownership, urgent visibility, files, cancellation and outpass', async t => {
  const db = await MongoMemoryServer.create(); await mongoose.connect(db.getUri());
  const codes = new Map();
  const users = ['student','other','class.teacher','hod','warden','director'].map((name,i) => ({ id: String(i), name, email: `${name}${i<2 ? '_123456' : ''}@aitpune.edu.in`, role: i<2 ? 'student' : 'faculty', approver_role: i<2 ? undefined : CHAINS.LEAVE[i-2] }));
  const app = createApp({ config: { secret: 'a'.repeat(40), domain:'aitpune.edu.in', otpMs:300000, sessionMs:3600000, origin:'http://localhost:5173' }, users: { findOne: async query => users.find(u => u.email === query.email && u.role === query.role) }, sendMail: async (email,code) => codes.set(email,code) });
  t.after(async () => { app.locals.close(); await mongoose.disconnect(); await db.stop(); });
  await Application.LeaveType.create({ name:'Personal' });
  const agents = [];
  for (const u of users) { const agent = request.agent(app); await agent.post('/api/auth/request-otp').send({ email:u.email, role:u.role }).expect(200); await agent.post('/api/auth/verify-otp').send({ email:u.email, role:u.role, otp:codes.get(u.email) }).expect(200); agents.push(agent); }
  const student = agents[0], fields = { reason: 'Family appointment tomorrow', leave_type:'Personal', from_date:'2026-10-20', to_date:'2026-10-21', is_urgent: true };
  const created = (await student.post('/api/applications/leave').send(fields).expect(201)).body; const path = `/api/applications/${created.id}`;
  assert.equal(created.is_urgent,true); assert.equal(created.fields.days,2);
  await agents[1].get(path).expect(404); await agents[1].post(path+'/cancel').send({}).expect(404);
  await agents[1].get(path+'/proof').expect(404);
  assert.equal((await student.get('/api/applications?urgent=true')).body.applications[0].is_urgent,true);
  assert.equal((await student.get('/api/home/summary')).body.urgent[0].id,created.id);
  const decision = { decision:'APPROVED', signature_data:'Demo Signer' };
  await agents[3].post(path+'/approvals').send(decision).expect(403);
  await student.post(path+'/approvals').send(decision).expect(403);
  for(let i=2;i<6;i++) { const result = await agents[i].post(path+'/approvals').send(decision).expect(200); assert.equal(result.body.status,i===5?'APPROVED':'IN_REVIEW'); if(i===2) await student.post(path+'/cancel').send({}).expect(400); }
  const detail = (await student.get(path)).body; assert.equal(detail.history.length,5); assert.equal(detail.steps.length,4);
  const cancel = (await student.post('/api/applications/leave').send(fields)).body;
  await student.post(`/api/applications/${cancel.id}/cancel`).send({}).expect(200);
  await student.post('/api/applications/leave').send({ ...fields, reason:'' }).expect(400);
  await student.post('/api/applications/leave').field('reason',fields.reason).field('leave_type','Personal').field('from_date',fields.from_date).field('to_date',fields.to_date).attach('proof',Buffer.from('fake'),{ filename:'fake.pdf', contentType:'application/pdf' }).expect(400);
  const proof = (await student.post('/api/applications/leave').field('reason',fields.reason).field('leave_type','Personal').field('from_date',fields.from_date).field('to_date',fields.to_date).attach('proof',Buffer.from('%PDF-test'),{ filename:'proof.pdf',contentType:'application/pdf' }).expect(201)).body;
  assert.equal(proof.attachment.data,undefined); await student.get(`/api/applications/${proof.id}/proof`).expect(200);
  const outpass = (await student.post('/api/applications/outpass').send({ reason:'Visit the nearby market', out_at:'2026-10-20T12:00',return_at:'2026-10-20T14:00',destination:'Market',contact:'9876543210',is_urgent:true }).expect(201)).body;
  assert.equal(outpass.steps.length,1);
  const approved = await agents[4].post(`/api/applications/${outpass.id}/approvals`).send(decision).expect(200); assert.equal(approved.body.status,'APPROVED');
});
