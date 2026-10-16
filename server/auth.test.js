const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('./auth');
function setup(t, overrides = {}) {
  let clock = Date.now(), code;
  const config = { secret: 'test-secret-that-is-at-least-32-characters', domain: 'aitpune.edu.in', otpMs: 300000, sessionMs: 3600000, origin: 'http://localhost:5173', production: false, ...overrides };
  const app = createApp({ config, now: () => clock, users: { findOne: async ({ email, role }) => email === `${role}${role === 'student' ? '_123456' : ''}@aitpune.edu.in` ? { id: role, email, role, name: role } : null }, sendMail: async (email, otp) => { code = otp; } });
  t.after(() => app.locals.close());
  const agent = request.agent(app);
  const send = (email = 'student_123456@aitpune.edu.in', role = 'student') => agent.post('/api/auth/request-otp').send({ email, role });
  const verify = (otp = code, role = 'student', email = `${role}${role === 'student' ? '_123456' : ''}@aitpune.edu.in`) => agent.post('/api/auth/verify-otp').send({ email, role, otp });
  return { app, agent, send, verify, advance: ms => { clock += ms; } };
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

test('direct login issues a role-protected session only in local development', async t => {
  const s = setup(t, { devMode: true });
  assert.equal((await s.agent.get('/api/auth/config')).body.directLogin, true);
  await s.agent.post('/api/auth/login').send({ email: 'student_123456@aitpune.edu.in', role: 'student' }).expect(200);
  await s.agent.get('/api/student/dashboard').expect(200);
  await s.agent.get('/api/faculty/dashboard').expect(403);
  await s.agent.post('/api/auth/login').send({ email: 'unknown_123456@aitpune.edu.in', role: 'student' }).expect(400);
  for (const overrides of [{ devMode: false }, { devMode: true, production: true }]) {
    const locked = setup(t, overrides);
    assert.equal((await locked.agent.get('/api/auth/config')).body.directLogin, false);
    await locked.agent.post('/api/auth/login').send({ email: 'student_123456@aitpune.edu.in', role: 'student' }).expect(403);
  }
});

test('local cookie survives the next request; idle activity extends idle but never absolute expiry', async t => {
  const s = setup(t, {devMode:true,sessionMs:8*3600000,idleMs:30*60000});
  const login=await s.agent.post('/api/auth/login').send({email:'student_123456@aitpune.edu.in',role:'student'}).expect(200);
  assert.match(login.headers['set-cookie'][0],/Path=\//); assert.doesNotMatch(login.headers['set-cookie'][0],/; Secure/);
  await s.agent.get('/api/auth/session').expect(200);
  const absolute=login.body.expiresAt;
  s.advance(29*60000); const refreshed=await s.agent.post('/api/auth/activity').send({}).expect(200);
  assert.equal(refreshed.body.expiresAt,absolute); assert.ok(refreshed.body.idleExpiresAt>login.body.idleExpiresAt);
  s.advance(29*60000); await s.agent.get('/api/auth/session').expect(200);
  s.advance(60001); await s.agent.get('/api/auth/session').expect(401);
  const active=setup(t,{devMode:true,sessionMs:8*3600000,idleMs:30*60000});
  await active.agent.post('/api/auth/login').send({email:'student_123456@aitpune.edu.in',role:'student'}).expect(200);
  for(let i=0;i<16;i++){active.advance(29*60000);await active.agent.post('/api/auth/activity').send({}).expect(200)}
  active.advance(16*60000+1);await active.agent.get('/api/auth/session').expect(401);
});
test('cookie Secure attribute follows configured HTTPS origin', async t=>{
  const s=setup(t,{devMode:true,origin:'https://college.example'});
  const login=await s.agent.post('/api/auth/login').send({email:'student_123456@aitpune.edu.in',role:'student'}).expect(200);
  assert.match(login.headers['set-cookie'][0],/; Secure/);
});
