const path = require('node:path')
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true })

function config() {
  const production = process.env.NODE_ENV === 'production'
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) throw new Error('Set SESSION_SECRET to at least 32 random characters.')
  const origin = 'http://localhost:5173'
  if (process.env.APP_ORIGIN && process.env.APP_ORIGIN !== origin) {
    throw new Error(`APP_ORIGIN must remain ${origin}; this app is configured for local use only.`)
  }
  if (process.env.APP_ORIGINS?.trim()) {
    throw new Error('APP_ORIGINS is not supported; this app accepts requests only from its local frontend.')
  }
  if (process.env.COOKIE_SAME_SITE && process.env.COOKIE_SAME_SITE !== 'strict') {
    throw new Error('COOKIE_SAME_SITE must be strict for local use.')
  }

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/leave_management'
  let mongoHost
  try {
    const databaseUrl = new URL(mongoUri)
    if (databaseUrl.protocol !== 'mongodb:') throw new Error()
    mongoHost = databaseUrl.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  } catch {
    throw new Error('MONGODB_URI must point to MongoDB running on this laptop.')
  }
  if (mongoHost !== 'localhost' && mongoHost !== '::1' && !mongoHost.startsWith('127.')) {
    throw new Error('MONGODB_URI must point to MongoDB running on this laptop.')
  }

  const positive = (key, fallback) => {
    const value = Number(process.env[key] || fallback)
    if (!Number.isFinite(value) || value < 1) throw new Error(`Invalid ${key}`)
    return value
  }

  const domain = (process.env.COLLEGE_DOMAIN || 'aitpune.edu.in').toLowerCase()
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) throw new Error('Invalid COLLEGE_DOMAIN')
  const devMode = process.env.DEV_MODE === 'true' && !production
  return {
    production,
    secret,
    domain,
    devMode,
    idleMs: positive('SESSION_IDLE_SECONDS', 1800) * 1000,
    sessionMs: positive('SESSION_EXPIRY_SECONDS', 28800) * 1000,
    origin,
    allowedOrigins: [origin],
    cookieSameSite: 'strict',
    mongoUri,
  }
}

module.exports = config
