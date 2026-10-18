const { test } = require('node:test')
const assert = require('node:assert/strict')
const config = require('./config')

const keys = ['NODE_ENV', 'MONGODB_URI', 'APP_ORIGIN', 'APP_ORIGINS', 'SESSION_SECRET', 'COOKIE_SAME_SITE']

function setEnvironment(t, { production = false, mongoUri = 'mongodb://localhost:27017/leave_management', origin = 'http://localhost:5173' } = {}) {
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
  process.env.NODE_ENV = production ? 'production' : 'development'
  process.env.SESSION_SECRET = 'test-secret-that-is-at-least-32-characters'
  process.env.MONGODB_URI = mongoUri
  process.env.APP_ORIGIN = origin
  delete process.env.APP_ORIGINS
  delete process.env.COOKIE_SAME_SITE
}

test('local configuration uses the laptop MongoDB and local frontend origin', (t) => {
  setEnvironment(t)
  const configured = config()
  assert.equal(configured.mongoUri, 'mongodb://localhost:27017/leave_management')
  assert.equal(configured.origin, 'http://localhost:5173')
  assert.deepEqual(configured.allowedOrigins, ['http://localhost:5173'])
  assert.equal(configured.cookieSameSite, 'strict')
})

test('production mode can still run locally against the laptop MongoDB', (t) => {
  setEnvironment(t, { production: true })
  assert.equal(config().production, true)
})

test('remote MongoDB connections are rejected in every mode', (t) => {
  setEnvironment(t, { mongoUri: 'mongodb+srv://cluster.example.mongodb.net/leave_management' })
  assert.throws(() => config(), /MONGODB_URI must point to MongoDB running on this laptop/)
})

test('MongoDB connections to non-loopback addresses are rejected', (t) => {
  setEnvironment(t, { mongoUri: 'mongodb://db.example.com:27017/leave_management' })
  assert.throws(() => config(), /MONGODB_URI must point to MongoDB running on this laptop/)
})

test('non-local frontend origins are rejected', (t) => {
  setEnvironment(t, { origin: 'https://leave.example.edu' })
  assert.throws(() => config(), /APP_ORIGIN must remain http:\/\/localhost:5173/)
})

test('additional frontend origins and cross-site cookies are rejected', (t) => {
  setEnvironment(t)
  process.env.APP_ORIGINS = 'https://leave.example.edu'
  assert.throws(() => config(), /APP_ORIGINS is not supported/)

  delete process.env.APP_ORIGINS
  process.env.COOKIE_SAME_SITE = 'none'
  assert.throws(() => config(), /COOKIE_SAME_SITE must be strict/)
})
