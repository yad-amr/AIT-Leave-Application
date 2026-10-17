const path = require('node:path')
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true })

function config() {
  const production = process.env.NODE_ENV === 'production'
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) throw new Error('Set SESSION_SECRET to at least 32 random characters.')
  const origin = process.env.APP_ORIGIN || 'http://localhost:5173'
  const additionalOrigins = (process.env.APP_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean)
  const cookieSameSite = process.env.COOKIE_SAME_SITE || 'strict'
  if (!['strict', 'lax', 'none'].includes(cookieSameSite)) throw new Error('Invalid COOKIE_SAME_SITE')
  for (const allowedOrigin of additionalOrigins) {
    let parsedOrigin
    try { parsedOrigin = new URL(allowedOrigin) } catch { parsedOrigin = null }
    if (parsedOrigin?.origin !== allowedOrigin || (production && parsedOrigin.protocol !== 'https:')) {
      throw new Error('APP_ORIGINS must contain exact origins without paths; production origins must use HTTPS.')
    }
  }
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/leave_management'
  const hostedOnLaptop = process.env.HOSTED_ON_LAPTOP === 'true'
  if (production) {
    let mongoHost
    try {
      const databaseUrl = new URL(mongoUri)
      if (!['mongodb:', 'mongodb+srv:'].includes(databaseUrl.protocol)) throw new Error()
      mongoHost = databaseUrl.hostname.toLowerCase()
    } catch {
      throw new Error('Set MONGODB_URI to a valid MongoDB connection string in production.')
    }
    mongoHost = mongoHost.replace(/^\[|\]$/g, '')
    const localMongoHost = mongoHost === 'localhost' || mongoHost === '::1' || mongoHost.startsWith('127.')
    if (!process.env.MONGODB_URI || (localMongoHost && !hostedOnLaptop)) {
      throw new Error('Set MONGODB_URI to a shared, remotely hosted MongoDB database in production.')
    }
    let publicOrigin
    try { publicOrigin = new URL(origin) } catch { publicOrigin = null }
    if (!process.env.APP_ORIGIN || publicOrigin?.protocol !== 'https:' || publicOrigin.origin !== origin) {
      throw new Error('Set APP_ORIGIN to the public HTTPS origin of this app in production.')
    }
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
    allowedOrigins: [origin, ...additionalOrigins],
    cookieSameSite,
    mongoUri,
    hostedOnLaptop,
  }
}

module.exports = config
