const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('./auth');
function setup(t, leaveRequests) {
  let clock = Date.now(), code;
  const config = { secret: 'test-secret-that-is-at-least-32-characters', domain: 'aitpune.edu.in', otpMs: 300000, sessionMs: 3600000, origin: 'http://localhost:5173', production: false };
  const app = createApp({ config, now: () => clock, leaveRequests, users: { findOne: async ({ email, role }) => {
    if (role === 'student' && email === 'student_123456@aitpune.edu.in') return { id: role, email, role, name: role };
    if (role === 'faculty') {
      const approvalRole = { warden: 'warden', counsellor: 'counsellor', hod: 'hod', joint_director: 'joint_director', faculty: 'warden' }[email.split('@')[0]];
      if (approvalRole) return { id: email, email, role, approval_role: approvalRole, name: approvalRole };
    }
    return null;
  } }, sendMail: async (email, otp) => { code = otp; } });
  t.after(() => app.locals.close());
  const agent = request.agent(app);
  const send = (email = 'student_123456@aitpune.edu.in', role = 'student') => agent.post('/api/auth/request-otp').send({ email, role });
  const verify = (otp = code, role = 'student', email = `${role}${role === 'student' ? '_123456' : ''}@aitpune.edu.in`) => agent.post('/api/auth/verify-otp').send({ email, role, otp });
  return { app, agent, send, verify, advance: ms => { clock += ms; } };
}
function inMemoryRequests() {
  const rows = [];
  let nextId = 0;
  return class MemoryRequest {
    constructor(fields) {
      Object.assign(this, fields);
      this.timeline ||= [];
      this.status ||= 'pending';
      this.currentStage ||= 'warden';
      this._id = `request-${++nextId}`;
    }
    async save() {
      const index = rows.findIndex(row => row._id === this._id);
      if (index < 0) rows.push(this); else rows[index] = this;
      return this;
    }
    static find(query) {
      const matches = rows.filter(row =>
        (!query.studentEmail || row.studentEmail === query.studentEmail) &&
        (!query.status || row.status === query.status) &&
        (!query.currentStage || row.currentStage === query.currentStage) &&
        (!query['timeline.actorEmail'] || row.timeline.some(event => event.actorEmail === query['timeline.actorEmail']))
      );
      return { sort() { return this; }, lean: async () => structuredClone(matches) };
    }
    static async findOne(query) {
      return rows.find(row => row._id === query._id && row.status === query.status && row.currentStage === query.currentStage) || null;
    }
  };
}
test('domain validation rejects external domains and malformed email', async t => {
  const s = setup(t);
  for (const email of ['abc@gmail.com', 'abc@evilaitpune.edu.in', 'a@aitpune.edu.in.evil.com', 'invalid']) assert.equal((await s.send(email)).status, 400);
  assert.equal((await s.send('STUDENT_123456@AITPUNE.EDU.IN')).status, 200);
});
test('OTP expires after five minutes', async t => {
  const s = setup(t); await s.send(); s.advance(300001); assert.equal((await s.verify()).status, 400);
});
test('five failed attempts lock verification even after resend', async t => {
  const s = setup(t); await s.send();
  for (let i = 0; i < 5; i++) assert.equal((await s.verify('invalid')).status, 400);
  s.advance(31000); await s.send(); assert.equal((await s.verify()).status, 429);
  s.advance(300001); await s.send(); assert.equal((await s.verify()).status, 200);
});
test('OTP is single use, session is role protected and logout revokes cookie replay', async t => {
  const s = setup(t); await s.send(); const login = await s.verify(); assert.equal(login.status, 200);
  const cookie = login.headers['set-cookie'][0].split(';')[0];
  assert.match(login.headers['set-cookie'][0], /HttpOnly/); assert.match(login.headers['set-cookie'][0], /SameSite=Strict/);
  assert.equal((await s.verify()).status, 400);
  assert.equal((await s.agent.get('/api/auth/session')).status, 200);
  assert.equal((await s.agent.get('/api/student/dashboard')).status, 200);
  assert.equal((await s.agent.get('/api/faculty/dashboard')).status, 403);
  await s.agent.post('/api/auth/logout').send({});
  assert.equal((await request(s.app).get('/api/auth/session').set('Cookie', cookie)).status, 401);
});
test('faculty signs in and cannot access student API', async t => {
  const s = setup(t); await s.send('faculty@aitpune.edu.in', 'faculty'); assert.equal((await s.verify(undefined, 'faculty')).status, 200);
  assert.equal((await s.agent.get('/api/student/dashboard')).status, 403);
  assert.equal((await s.agent.get('/api/faculty/dashboard')).status, 200);
});
test('unknown accounts receive the same challenge response but cannot sign in', async t => {
  const s = setup(t); assert.equal((await s.send('unknown_123456@aitpune.edu.in')).status, 200);
  assert.equal((await s.verify(undefined, 'student', 'unknown_123456@aitpune.edu.in')).status, 400);
});
test('email and IP request limits plus resend cooldown', async t => {
  const s = setup(t); await s.send(); assert.equal((await s.send()).status, 429);
  for (let i = 0; i < 3; i++) { s.advance(31000); await s.send(); }
  s.advance(31000); assert.equal((await s.send()).status, 429);
  for (let i = 0; i < 14; i++) await s.send(`user_${String(i).padStart(6, '0')}@aitpune.edu.in`);
  assert.equal((await s.send('another_123456@aitpune.edu.in')).status, 429);
});
test('missing and expired sessions are rejected, foreign origins blocked', async t => {
  const s = setup(t); assert.equal((await s.agent.get('/api/student/dashboard')).status, 401);
  assert.equal((await s.agent.post('/api/auth/request-otp').set('Origin','https://evil.example').send({ email:'student_123456@aitpune.edu.in', role:'student' })).status, 403);
  await s.send(); await s.verify(); s.advance(3600001); assert.equal((await s.agent.get('/api/auth/session')).status, 401);
});
test('role-specific college email templates enforce six registration digits', async t => {
  const s = setup(t);
  for (const email of ['name@aitpune.edu.in', 'name_12345@aitpune.edu.in', 'name_1234567@aitpune.edu.in', 'name_abcdef@aitpune.edu.in']) {
    assert.equal((await s.send(email, 'student')).status, 400);
    assert.equal((await s.agent.post('/api/auth/verify-otp').send({ email, role: 'student', otp: '123456' })).status, 400);
  }
  assert.equal((await s.send('name_123456@aitpune.edu.in', 'student')).status, 200);
  assert.equal((await s.send('name_123456@aitpune.edu.in', 'faculty')).status, 400);
  assert.equal((await s.send('name@aitpune.edu.in', 'faculty')).status, 200);
});
test('leave tokens move through four signed approval stages and retain contact/log history', async t => {
  const s = setup(t, inMemoryRequests());
  await s.send(); await s.verify();
  const created = await s.agent.post('/api/student/requests').send({
    leaveType: 'Hostel leave', startDate: '2026-11-10', endDate: '2026-11-12',
    destination: 'Pune', reason: 'Family event',
  });
  assert.equal(created.status, 201);
  assert.match(created.body.request.token, /^AIT-\d{4}-[A-F0-9]{8}$/);
  assert.equal((await s.agent.get('/api/faculty/requests')).status, 403);
  assert.equal((await s.agent.get('/api/student/requests')).body.requests.length, 1);

  await s.send('warden@aitpune.edu.in', 'faculty'); await s.verify(undefined, 'faculty', 'warden@aitpune.edu.in');
  const contact = await s.agent.post(`/api/faculty/requests/${created.body.request._id}/respond`).send({ action: 'needs_information', note: 'Please confirm your return date.' });
  assert.equal(contact.status, 200);
  assert.equal(contact.body.request.currentStage, 'warden');
  assert.equal((await s.agent.get('/api/faculty/requests')).body.requests.length, 1);
  assert.equal((await s.agent.get('/api/faculty/logs')).body.logs.length, 1);
  assert.equal((await s.agent.post(`/api/faculty/requests/${created.body.request._id}/respond`).send({ action: 'approved' })).status, 200);

  for (const role of ['counsellor', 'hod', 'joint_director']) {
    const email = `${role}@aitpune.edu.in`;
    await s.send(email, 'faculty'); await s.verify(undefined, 'faculty', email);
    const pending = await s.agent.get('/api/faculty/requests');
    assert.equal(pending.body.requests[0].currentStage, role);
    const response = await s.agent.post(`/api/faculty/requests/${created.body.request._id}/respond`).send({ action: 'approved' });
    assert.equal(response.status, 200);
  }
  const approved = await s.agent.get('/api/faculty/requests?view=approved');
  assert.equal(approved.body.requests.length, 1);
  assert.equal(approved.body.requests[0].status, 'approved');
  assert.equal(approved.body.requests[0].timeline.length, 6);
  assert.ok(approved.body.requests[0].timeline.every(event => /^[a-f0-9]{64}$/.test(event.signature)));
});
