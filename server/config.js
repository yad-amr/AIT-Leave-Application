const path = require('node:path')
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true })

function config() {
  const production = process.env.NODE_ENV === 'production'
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) throw new Error('Set SESSION_SECRET to at least 32 random characters.')

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
    origin: process.env.APP_ORIGIN || 'http://localhost:5173',
  }
}

module.exports = config
