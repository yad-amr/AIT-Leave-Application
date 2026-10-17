const { test } = require('node:test')
const assert = require('node:assert/strict')
const config = require('./config')

const keys = ['NODE_ENV', 'MONGODB_URI', 'APP_ORIGIN', 'APP_ORIGINS', 'SESSION_SECRET', 'HOSTED_ON_LAPTOP', 'COOKIE_SAME_SITE']
const remoteMongoUri = 'mongodb+srv://cluster.example.mongodb.net/leave_management'

function setProductionEnvironment(t, { mongoUri, origin = 'https://leave.example.edu', hostedOnLaptop } = {}) {
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
  process.env.NODE_ENV = 'production'
  process.env.SESSION_SECRET = 'test-secret-that-is-at-least-32-characters'
  process.env.MONGODB_URI = mongoUri
  process.env.APP_ORIGIN = origin
  delete process.env.APP_ORIGINS
  delete process.env.COOKIE_SAME_SITE
  if (hostedOnLaptop) process.env.HOSTED_ON_LAPTOP = 'true'
  else delete process.env.HOSTED_ON_LAPTOP
}

test('production requires a remote MongoDB unless explicitly hosting on the laptop', (t) => {
  setProductionEnvironment(t, { mongoUri: 'mongodb://localhost:27017/leave_management' })
  assert.throws(() => config(), /remotely hosted MongoDB/)

  process.env.HOSTED_ON_LAPTOP = 'true'
  assert.equal(config().hostedOnLaptop, true)
})

test('laptop hosting still requires an HTTPS public app origin', (t) => {
  setProductionEnvironment(t, {
    mongoUri: 'mongodb://localhost:27017/leave_management',
    origin: 'http://localhost:5173',
    hostedOnLaptop: true,
  })
  assert.throws(() => config(), /public HTTPS origin/)
})

test('production accepts a remote MongoDB with an HTTPS origin', (t) => {
  setProductionEnvironment(t, {
    mongoUri: 'mongodb+srv://user:password@cluster.example.mongodb.net/leave_management',
  })
  assert.equal(config().origin, 'https://leave.example.edu')
  assert.equal(config().hostedOnLaptop, false)
  assert.equal(config().cookieSameSite, 'strict')
})

test('production accepts additional exact HTTPS frontend origins', (t) => {
  setProductionEnvironment(t, {
    mongoUri: remoteMongoUri,
    origin: 'https://yad-amr.github.io',
  })
  process.env.APP_ORIGINS = ' https://ait-leave-application.onrender.com, https://leave.example.edu '
  const configured = config()
  assert.deepEqual(configured.allowedOrigins, [
    'https://yad-amr.github.io',
    'https://ait-leave-application.onrender.com',
    'https://leave.example.edu',
  ])
})

test('production rejects additional origins that are not exact HTTPS origins', (t) => {
  setProductionEnvironment(t, {
    mongoUri: remoteMongoUri,
  })
  process.env.APP_ORIGINS = 'https://preview.example.edu/path'
  assert.throws(() => config(), /exact origins without paths/)

  process.env.APP_ORIGINS = 'http://preview.example.edu'
  assert.throws(() => config(), /production origins must use HTTPS/)
})

test('production can enable cross-site session cookies for GitHub Pages', (t) => {
  setProductionEnvironment(t, {
    mongoUri: remoteMongoUri,
    origin: 'https://yad-amr.github.io',
  })
  process.env.MONGODB_URI = 'mongodb+srv://cluster.example.mongodb.net/leave_management'
  process.env.COOKIE_SAME_SITE = 'none'
  assert.equal(config().cookieSameSite, 'none')
})
