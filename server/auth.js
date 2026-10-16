const crypto = require('node:crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

function createApp({ config, users, sendMail, now = Date.now }) {
  const app = express();
  const challenges = new Map();
  const limits = new Map();
  const sessions = new Map();
  const hash = value => crypto.createHmac('sha256', config.secret).update(value).digest();
  const emailValid = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.split('@')[1] === config.domain;
  const cookie = { httpOnly: true, secure: config.production, sameSite: 'strict', path: '/' };
  app.use(helmet(), express.json({ limit: '4kb' }), cookieParser());
  app.use('/api', (req, res, next) => {
    if (req.method !== 'GET' && req.headers.origin && req.headers.origin !== config.origin) return res.status(403).json({ error: 'Request rejected.' });
    next();
  });
  // Periodic pruning bounds memory without retaining expired codes or identifiers.
  const cleanup = setInterval(() => {
    for (const [key, value] of challenges) if (value.expires <= now()) challenges.delete(key);
    for (const [key, value] of limits) if (value.until <= now()) limits.delete(key);
    for (const [key, value] of sessions) if (value <= now()) sessions.delete(key);
  }, 60000);
  cleanup.unref();
  app.locals.close = () => clearInterval(cleanup);
  function limit(key, max, window) {
    let item = limits.get(key);
    if (!item || item.until <= now()) { item = { count: 0, until: now() + window }; limits.set(key, item); }
    item.count++;
    return item.count <= max;
  }
  function identity(req, res, next) {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!emailValid(email)) return res.status(400).json({ error: `Use your college email ending in @${config.domain}.` });
    if (!['student', 'faculty'].includes(req.body.role)) return res.status(400).json({ error: 'Select Student or Faculty.' });
    req.email = email;
    req.key = `${email}:${req.body.role}`;
    next();
  }
  app.get('/api/auth/config', (req, res) => res.json({ domain: config.domain }));
  app.post('/api/auth/request-otp', identity, async (req, res, next) => {
    try {
      const ipAllowed = limit(`send-ip:${req.ip}`, 20, 15 * 60000);
      const emailAllowed = limit(`send-email:${req.email}`, 5, 15 * 60000);
      if (!ipAllowed || !emailAllowed) return res.status(429).json({ error: 'Too many requests. Try again in 15 minutes.' });
      const previous = challenges.get(req.key);
      if (previous && previous.sent + 30000 > now()) return res.status(429).json({ error: 'Please wait 30 seconds before requesting another code.' });
      // Keep failed verification budgets across resends.
      const otp = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
      const expires = now() + config.otpMs;
      challenges.set(req.key, { digest: hash(otp), expires, sent: now(), attempts: 0 });
      // Send identical mail for all valid-domain addresses; account lookup occurs only after proof of email ownership.
      try { await sendMail(req.email, otp); } catch { challenges.delete(req.key); return res.status(503).json({ error: 'Unable to send a code. Please try again later.' }); }
      res.json({ message: 'If this address is eligible, use the code sent to your college inbox.', expiresAt: expires, resendAt: now() + 30000, attemptsLeft: 5 });
    } catch (error) { next(error); }
  });
  app.post('/api/auth/verify-otp', identity, async (req, res, next) => {
    try {
      const ipAllowed = limit(`verify-ip:${req.ip}`, 60, 15 * 60000);
      const emailAllowed = limit(`verify-email:${req.email}`, 5, config.otpMs);
      if (!ipAllowed || !emailAllowed) return res.status(429).json({ error: 'Too many attempts. Wait for the verification window to reset.', attemptsLeft: 0 });
      const challenge = challenges.get(req.key);
      const digest = hash(String(req.body.otp || ''));
      const matches = crypto.timingSafeEqual(digest, challenge?.digest || hash('invalid'));
      if (challenge) challenge.attempts++;
      if (!challenge || challenge.expires <= now() || challenge.attempts > 5 || !/^\d{6}$/.test(String(req.body.otp)) || !matches) {
        return res.status(400).json({ error: 'Unable to verify this code. Check the code or request a new one.', attemptsLeft: Math.max(0, 5 - (challenge?.attempts || 5)) });
      }
      challenges.delete(req.key); // Consume before the asynchronous account lookup.
      const user = await users.findOne({ email: req.email, role: req.body.role });
      if (!user) return res.status(400).json({ error: 'Unable to sign in. Check your details or contact your college administrator.' });
      const sid = crypto.randomUUID();
      sessions.set(sid, now() + config.sessionMs);
      const token = jwt.sign({ sub: String(user.id || user._id), email: user.email, role: user.role, name: user.name, sid }, config.secret, { expiresIn: Math.floor(config.sessionMs / 1000) });
      res.cookie('session', token, { ...cookie, maxAge: config.sessionMs });
      res.json({ user: { email: user.email, role: user.role, name: user.name } });
    } catch (error) { next(error); }
  });
  function authenticated(req, res, next) {
    try {
      const user = jwt.verify(req.cookies.session, config.secret, { algorithms: ['HS256'] });
      if (!sessions.has(user.sid) || sessions.get(user.sid) <= now()) throw new Error('Expired');
      req.user = user;
      next();
    } catch { res.status(401).json({ error: 'Your session has expired. Please sign in again.' }); }
  }
  app.get('/api/auth/session', authenticated, (req, res) => res.json({ user: { email: req.user.email, role: req.user.role, name: req.user.name } }));
  app.post('/api/auth/logout', (req, res) => {
    try { sessions.delete(jwt.verify(req.cookies.session, config.secret).sid); } catch { /* already signed out */ }
    res.clearCookie('session', cookie).json({ message: 'Signed out.' });
  });
  for (const role of ['student', 'faculty']) app.get(`/api/${role}/dashboard`, authenticated, (req, res) => {
    if (req.user.role !== role) return res.status(403).json({ error: 'This page is for a different role.' });
    res.json({ message: `Welcome to your ${role} dashboard.` });
  });
  app.use((error, req, res, next) => { // eslint-disable-line no-unused-vars
    res.status(error.type === 'entity.parse.failed' ? 400 : 500).json({ error: 'Unable to process your request. Please try again.' });
  });
  return app;
}
function mailer(config) {
  if (config.devMode) return async (email, otp) => console.log(`[DEV_MODE ONLY] Code for ${email}: ${otp}`);
  const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  return (email, otp) => transport.sendMail({ from: process.env.SMTP_FROM, to: email, subject: 'Your Smart Leave sign-in code', text: `Your sign-in code is ${otp}. It expires in ${config.otpMs / 60000} minutes. If you did not request it, ignore this email.` });
}
module.exports = { createApp, mailer };
