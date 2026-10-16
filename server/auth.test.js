const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('./auth');
function setup(t) {
  let clock = Date.now(), code;
  const config = { secret: 'test-secret-that-is-at-least-32-characters', domain: 'ait.edu', otpMs: 300000, sessionMs: 3600000, origin: 'http://localhost:5173', production: false };
  const app = createApp({ config, now: () => clock, users: { findOne: async ({ email, role }) => email === `${role}@ait.edu` ? { id: role, email, role, name: role } : null }, sendMail: async (email, otp) => { code = otp; } });
  t.after(() => app.locals.close());
  const agent = request.agent(app);
  const send = (email = 'student@ait.edu', role = 'student') => agent.post('/api/auth/request-otp').send({ email, role });
  const verify = (otp = code, role = 'student', email = `${role}@ait.edu`) => agent.post('/api/auth/verify-otp').send({ email, role, otp });
  return { app, agent, send, verify, advance: ms => { clock += ms; } };
}
test('domain validation rejects external domains and malformed email', async t => {
  const s = setup(t);
  for (const email of ['abc@gmail.com', 'abc@evilait.edu', 'a@ait.edu.evil.com', 'invalid']) assert.equal((await s.send(email)).status, 400);
  assert.equal((await s.send('STUDENT@AIT.EDU')).status, 200);
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
  const s = setup(t); await s.send('faculty@ait.edu', 'faculty'); assert.equal((await s.verify(undefined, 'faculty')).status, 200);
  assert.equal((await s.agent.get('/api/student/dashboard')).status, 403);
  assert.equal((await s.agent.get('/api/faculty/dashboard')).status, 200);
});
test('unknown accounts receive the same challenge response but cannot sign in', async t => {
  const s = setup(t); assert.equal((await s.send('unknown@ait.edu')).status, 200);
  assert.equal((await s.verify(undefined, 'student', 'unknown@ait.edu')).status, 400);
});
test('email and IP request limits plus resend cooldown', async t => {
  const s = setup(t); await s.send(); assert.equal((await s.send()).status, 429);
  for (let i = 0; i < 3; i++) { s.advance(31000); await s.send(); }
  s.advance(31000); assert.equal((await s.send()).status, 429);
  for (let i = 0; i < 14; i++) await s.send(`user${i}@ait.edu`);
  assert.equal((await s.send('another@ait.edu')).status, 429);
});
test('missing and expired sessions are rejected, foreign origins blocked', async t => {
  const s = setup(t); assert.equal((await s.agent.get('/api/student/dashboard')).status, 401);
  assert.equal((await s.agent.post('/api/auth/request-otp').set('Origin','https://evil.example').send({ email:'student@ait.edu', role:'student' })).status, 403);
  await s.send(); await s.verify(); s.advance(3600001); assert.equal((await s.agent.get('/api/auth/session')).status, 401);
});
