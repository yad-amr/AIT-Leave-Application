const crypto = require('node:crypto')
const express = require('express')
const cookieParser = require('cookie-parser')
const helmet = require('helmet')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const path = require('node:path')

function createApp({ config, users, now = Date.now }) {
  const limits = new Map()
  const sessions = new Map()
  const idleMs = config.idleMs || 30 * 60000
  const app = express()
  const allowedOrigins = new Set(config.allowedOrigins || [config.origin])
  const cookie = { httpOnly: true, secure: config.production && config.origin.startsWith('https:'), sameSite: 'strict', path: '/' }

  app.use(helmet(), express.json({ limit: '4kb' }), cookieParser())
  app.use('/api', (req, res, next) => {
    const allowedOrigin = allowedOrigins.has(req.headers.origin)
    if (req.headers.origin && !allowedOrigin) {
      return res.status(403).json({ error: 'Request rejected.' })
    }
    if (req.headers.origin && allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin)
      res.setHeader('Access-Control-Allow-Credentials', 'true')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      res.setHeader('Vary', 'Origin')
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    next()
  })

  const cleanup = setInterval(() => {
    for (const [key, value] of limits) if (value.until <= now()) limits.delete(key)
    for (const [key, value] of sessions) if (Math.min(value.expiresAt, value.idleExpiresAt) <= now()) sessions.delete(key)
  }, 60000)
  cleanup.unref()
  app.locals.close = () => clearInterval(cleanup)

  function limit(key, max, windowMs) {
    let item = limits.get(key)
    if (!item || item.until <= now()) {
      item = { count: 0, until: now() + windowMs }
      limits.set(key, item)
    }
    item.count++
    return item.count <= max
  }

  function validEmail(email, role) {
    if (!['student', 'faculty'].includes(role)) return false
    const parts = email.split('@')
    if (parts.length !== 2 || parts[1] !== config.domain) return false
    const pattern = role === 'student' ? /^[a-z][a-z.-]*_\d{6}$/i : /^[a-z][a-z.-]*(?:_[a-z][a-z0-9.-]*)?$/i
    return pattern.test(parts[0])
  }

  app.get('/api/auth/config', (_req, res) => res.json({ domain: config.domain }))

  app.post('/api/auth/login', async (req, res, next) => {
    try {
      const email = String(req.body.email || '').trim().toLowerCase()
      const password = req.body.password
      const role = req.body.role
      if (!validEmail(email, role)) {
        return res.status(400).json({ error: role === 'student' ? `Use name_123456@${config.domain} with a six-digit registration number.` : `Use name@${config.domain} or name_designation@${config.domain} for faculty sign-in.` })
      }
      if (typeof password !== 'string' || password.length < 8 || password.length > 200) {
        return res.status(400).json({ error: 'Enter a valid password.' })
      }
      if (!limit(`login-ip:${req.ip}`, 30, 15 * 60000) || !limit(`login-email:${email}`, 10, 15 * 60000)) {
        return res.status(429).json({ error: 'Too many sign-in attempts. Try again in 15 minutes.' })
      }

      let query = users.findOne({ email, role })
      if (typeof query.select === 'function') query = query.select('+passwordHash')
      const user = await query
      const validPassword = user?.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false
      if (!user || !validPassword) {
        return res.status(401).json({ error: 'Email or password is incorrect.' })
      }

      const sid = crypto.randomUUID()
      const session = { expiresAt: now() + config.sessionMs, idleExpiresAt: Math.min(now() + config.sessionMs, now() + idleMs) }
      sessions.set(sid, session)
      const token = jwt.sign(
        { sub: String(user.id || user._id), email: user.email, role: user.role, approvalRole: user.approvalRole || null, name: user.name, sid },
        config.secret,
        { expiresIn: Math.floor(config.sessionMs / 1000) },
      )
      res.cookie('session', token, { ...cookie, maxAge: config.sessionMs })
      return res.json({ user: { email: user.email, role: user.role, approvalRole: user.approvalRole || null, name: user.name }, ...session, idleTimeoutMs: idleMs })
    } catch (error) {
      return next(error)
    }
  })

  function authenticated(req, res, next) {
    try {
      const user = jwt.verify(req.cookies.session, config.secret, { algorithms: ['HS256'] })
      const session = sessions.get(user.sid)
      if (!session || Math.min(session.expiresAt, session.idleExpiresAt) <= now()) throw new Error('Expired')
      req.user = user
      req.session = session
      next()
    } catch {
      res.status(401).json({ error: 'Your session has expired. Please sign in again.' })
    }
  }

  app.post('/api/auth/change-password', authenticated, async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body || {}
      if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 200) {
        return res.status(400).json({ error: 'Enter your current password and a new password of at least 8 characters.' })
      }
      if (currentPassword === newPassword) return res.status(400).json({ error: 'Choose a new password that differs from your current password.' })
      if (!limit(`password-change:${req.user.sub}`, 5, 15 * 60000)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' })

      let query = users.findOne({ _id: req.user.sub, role: req.user.role })
      if (typeof query.select === 'function') query = query.select('+passwordHash')
      const user = await query
      if (!user?.passwordHash || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
        return res.status(401).json({ error: 'Current password is incorrect.' })
      }
      const passwordHash = await bcrypt.hash(newPassword, 12)
      await users.updateOne({ _id: user._id }, { $set: { passwordHash } })
      sessions.delete(req.user.sid)
      res.clearCookie('session', cookie)
      return res.json({ message: 'Password changed. Please sign in again with your new password.' })
    } catch (error) {
      return next(error)
    }
  })

  app.use('/api/leave-requests', authenticated, require('./routes/leaveRequestRoutes'))
  app.use('/api/faculty/approvals', authenticated, require('./routes/facultyApprovalRoutes'))
  app.get('/api/auth/session', authenticated, (req, res) => res.json({ user: { email: req.user.email, role: req.user.role, approvalRole: req.user.approvalRole || null, name: req.user.name }, ...req.session, idleTimeoutMs: idleMs }))
  app.post('/api/auth/activity', authenticated, (req, res) => {
    req.session.idleExpiresAt = Math.min(req.session.expiresAt, now() + idleMs)
    res.json({ expiresAt: req.session.expiresAt, idleExpiresAt: req.session.idleExpiresAt, idleTimeoutMs: idleMs })
  })
  app.post('/api/auth/logout', (req, res) => {
    try { sessions.delete(jwt.verify(req.cookies.session, config.secret).sid) } catch { /* already signed out */ }
    res.clearCookie('session', cookie).json({ message: 'Signed out.' })
  })
  for (const role of ['student', 'faculty']) {
    app.get(`/api/${role}/dashboard`, authenticated, (req, res) => {
      if (req.user.role !== role) return res.status(403).json({ error: 'This page is for a different role.' })
      res.json({ message: `Welcome to your ${role} dashboard.` })
    })
  }

  if (config.production) {
    const clientDist = path.resolve(__dirname, '../client/dist')
    app.use(express.static(clientDist, { index: false }))
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/') || !req.accepts('html')) return next()
      res.sendFile(path.join(clientDist, 'index.html'), (error) => {
        if (error) next(error)
      })
    })
  }

  app.use((error, _req, res, _next) => {
    const badRequest = error.type === 'entity.parse.failed' || String(error.code || '').startsWith('LIMIT_')
    res.status(badRequest ? 400 : 500).json({ error: badRequest ? 'Invalid request or uploaded file. Check the 5 MB file limit.' : 'Unable to process your request. Please try again.' })
  })
  return app
}

module.exports = { createApp }
