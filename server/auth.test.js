const { test } = require('node:test')
const assert = require('node:assert/strict')
const bcrypt = require('bcrypt')
const request = require('supertest')
const { createApp } = require('./auth')

function setup(t) {
  let clock = Date.now()
  const config = { secret: 'test-secret-that-is-at-least-32-characters', domain: 'aitpune.edu.in', sessionMs: 3600000, origin: 'http://localhost:5173', allowedOrigins: ['http://localhost:5173'], devMode: true, production: false }
  const records = [
    { id: 'student-id', email: 'student_123456@aitpune.edu.in', role: 'student', name: 'Demo student', college_id: 'STUDENT-240101', passwordHash: bcrypt.hashSync('StudentPass123!', 4) },
    { id: 'faculty-id', email: 'faculty@aitpune.edu.in', role: 'faculty', name: 'Demo faculty', passwordHash: bcrypt.hashSync('FacultyPass123!', 4) },
    { id: 'warden-id', email: 'beauty.das_wardengirlshostel@aitpune.edu.in', role: 'faculty', approvalRole: 'warden', name: 'Ms. Beauty Das', passwordHash: bcrypt.hashSync('FacultyPass123!', 4) },
  ]
  const users = {
    findOne: ({ email, role }) => ({ select: async () => records.find((user) => user.email === email && user.role === role) || null }),
  }
  const app = createApp({ config, users, now: () => clock })
  t.after(() => app.locals.close())
  const agent = request.agent(app)
  const login = (email = records[0].email, password = 'StudentPass123!', role = 'student') => agent.post('/api/auth/login').send({ email, password, role })
  return { app, agent, login, advance: (ms) => { clock += ms } }
}

test('student password login issues a secure session and opens only student routes', async (t) => {
  const state = setup(t)
  const response = await state.login()
  assert.equal(response.status, 200)
  assert.equal(response.body.user.role, 'student')
  assert.match(response.headers['set-cookie'][0], /HttpOnly/)
  assert.match(response.headers['set-cookie'][0], /SameSite=Strict/)
  assert.equal((await state.agent.get('/api/auth/session')).status, 200)
  assert.equal((await state.agent.get('/api/student/dashboard')).status, 200)
  assert.equal((await state.agent.get('/api/faculty/dashboard')).status, 403)
})

test('API allows credentialed requests only from the local frontend origin', async (t) => {
  const state = setup(t)
  const preflight = await request(state.app)
    .options('/api/auth/login')
    .set('Origin', 'http://localhost:5173')
    .set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'content-type')
  assert.equal(preflight.status, 204)
  assert.equal(preflight.headers['access-control-allow-origin'], 'http://localhost:5173')
  assert.equal(preflight.headers['access-control-allow-credentials'], 'true')
  const hosted = await request(state.app).get('/api/auth/config').set('Origin', 'https://leave.example.edu')
  assert.equal(hosted.status, 403)
  const blocked = await request(state.app).get('/api/auth/config').set('Origin', 'https://evil.example')
  assert.equal(blocked.status, 403)
})

test('wrong password, unknown account, and invalid email are rejected', async (t) => {
  const state = setup(t)
  assert.equal((await state.login(undefined, 'WrongPass123!')).status, 401)
  assert.equal((await state.login('unknown_123456@aitpune.edu.in')).status, 401)
  assert.equal((await state.login('student@gmail.com')).status, 400)
  assert.equal((await state.login('student_123456@aitpune.edu.in', 'short')).status, 400)
})

test('faculty password login cannot access student pages or student leave requests', async (t) => {
  const state = setup(t)
  assert.equal((await state.login('faculty@aitpune.edu.in', 'FacultyPass123!', 'faculty')).status, 200)
  assert.equal((await state.agent.get('/api/faculty/dashboard')).status, 200)
  assert.equal((await state.agent.get('/api/student/dashboard')).status, 403)
  assert.equal((await state.agent.get('/api/leave-requests')).status, 403)
})

test('faculty login accepts a name_designation email', async (t) => {
  const state = setup(t)
  const response = await state.login('beauty.das_wardengirlshostel@aitpune.edu.in', 'FacultyPass123!', 'faculty')
  assert.equal(response.status, 200)
  assert.equal(response.body.user.name, 'Ms. Beauty Das')
})

test('session is required and logout revokes the cookie', async (t) => {
  const state = setup(t)
  assert.equal((await state.agent.get('/api/auth/session')).status, 401)
  assert.equal((await state.agent.get('/api/leave-requests')).status, 401)
  const login = await state.login()
  const cookie = login.headers['set-cookie'][0].split(';')[0]
  await state.agent.post('/api/auth/logout').send({})
  assert.equal((await request(state.app).get('/api/auth/session').set('Cookie', cookie)).status, 401)
})

test('login rate limit and foreign-origin protection reject requests', async (t) => {
  const state = setup(t)
  const lanOrigin = await request(state.app).post('/api/auth/login').set('X-Forwarded-Host', '192.168.1.50:5173').set('Origin', 'http://192.168.1.50:5173').send({ email: 'student_123456@aitpune.edu.in', password: 'StudentPass123!', role: 'student' })
  assert.equal(lanOrigin.status, 403)
  for (let attempt = 0; attempt < 10; attempt++) await state.login(undefined, 'WrongPass123!')
  assert.equal((await state.login()).status, 429)
  const blocked = await request(state.app).post('/api/auth/login').set('Origin', 'https://evil.example').send({ email: 'student_123456@aitpune.edu.in', password: 'StudentPass123!', role: 'student' })
  assert.equal(blocked.status, 403)
})
