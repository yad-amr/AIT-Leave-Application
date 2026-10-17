const crypto = require('node:crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const LeaveRequest = require('./LeaveRequest');

const approvalRoles = ['warden', 'counsellor', 'hod', 'joint_director'];
const nextApprovalRole = role => approvalRoles[approvalRoles.indexOf(role) + 1] || null;

function createApp({ config, users, leaveRequests = LeaveRequest, sendMail, now = Date.now }) {
  const app = express();
  const challenges = new Map();
  const limits = new Map();
  const sessions = new Map();
  const idleMs = config.idleMs || 30 * 60000;
  const hash = value => crypto.createHmac('sha256', config.secret).update(value).digest();
  const emailValid = (email, role) => {
    const [local, domain] = email.split('@');
    const pattern = role === 'student' ? /^[a-z][a-z.-]*_\d{6}$/i : /^[a-z][a-z._-]*$/i;
    return email.split('@').length === 2 && domain === config.domain && pattern.test(local);
  };
  const cookie = { httpOnly: true, secure: config.origin?.startsWith('https://') || false, sameSite: 'strict', path: '/' };
  app.use(helmet(), express.json({ limit: '16kb' }), cookieParser());
  app.use('/api', (req, res, next) => {
    if (req.method !== 'GET' && req.headers.origin && req.headers.origin !== config.origin) return res.status(403).json({ error: 'Request rejected.' });
    next();
  });
  // Periodic pruning bounds memory without retaining expired codes or identifiers.
  const cleanup = setInterval(() => {
    for (const [key, value] of challenges) if (value.expires <= now()) challenges.delete(key);
    for (const [key, value] of limits) if (value.until <= now()) limits.delete(key);
    for (const [key, value] of sessions) if (Math.min(value.expiresAt, value.idleExpiresAt) <= now()) sessions.delete(key);
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
    if (!emailValid(email, req.body.role)) return res.status(400).json({ error: req.body.role === 'student' ? `Use name_123456@${config.domain} with a six-digit registration number.` : `Use name@${config.domain} for faculty sign-in.` });
    if (!['student', 'faculty'].includes(req.body.role)) return res.status(400).json({ error: 'Select Student or Faculty.' });
    req.email = email;
    req.key = `${email}:${req.body.role}`;
    next();
  }
  function signIn(res, user) {
      const sid = crypto.randomUUID();
      sessions.set(sid, { expiresAt: now() + config.sessionMs, idleExpiresAt: now() + idleMs });
      const token = jwt.sign({ sub: String(user.id || user._id), email: user.email, role: user.role, name: user.name, approver_role: user.approver_role, approvalRole: user.approval_role || null, sid }, config.secret, { expiresIn: Math.floor(config.sessionMs / 1000) });
      res.cookie('session', token, { ...cookie, maxAge: config.sessionMs });
      res.json({ user: { email: user.email, role: user.role, name: user.name, approvalRole: user.approval_role || null }, ...sessions.get(sid), idleTimeoutMs: idleMs });
  }
  app.post('/api/auth/login', identity, async (req, res, next) => {
    if (!config.devMode || config.production) return res.status(403).json({ error: 'Direct login is only available in local development.' });
    if (!limit(`direct-login:${req.ip}`, 30, 15 * 60000)) return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
    try {
      const user = await users.findOne({ email: req.email, role: req.body.role });
      if (!user) return res.status(400).json({ error: 'Account not found. Use a seeded college account.' });
      signIn(res, user);
    } catch (error) { next(error); }
  });
  app.get('/api/auth/config', (req, res) => res.json({ domain: config.domain, directLogin: !!config.devMode && !config.production }));
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
      signIn(res, user);
    } catch (error) { next(error); }
  });
  function authenticated(req, res, next) {
    try {
      const user = jwt.verify(req.cookies.session, config.secret, { algorithms: ['HS256'] });
      if (!sessions.has(user.sid) || Math.min(sessions.get(user.sid).expiresAt, sessions.get(user.sid).idleExpiresAt) <= now()) throw new Error('Expired');
      req.user = user;
      next();
    } catch { res.status(401).json({ error: 'Your session has expired. Please sign in again.' }); }
  }
  app.get('/api/auth/session', authenticated, (req, res) => res.json({ user: { email: req.user.email, role: req.user.role, name: req.user.name, approvalRole: req.user.approvalRole || null }, ...sessions.get(req.user.sid), idleTimeoutMs: idleMs }));
  app.post('/api/auth/activity', authenticated, (req,res) => {
    const session = sessions.get(req.user.sid);
    session.idleExpiresAt = Math.min(session.expiresAt, now() + idleMs);
    res.json({ ...session, idleTimeoutMs: idleMs });
  });
  app.post('/api/auth/logout', (req, res) => {
    try { sessions.delete(jwt.verify(req.cookies.session, config.secret).sid); } catch { /* already signed out */ }
    res.clearCookie('session', cookie).json({ message: 'Signed out.' });
  });
  for (const role of ['student', 'faculty']) app.get(`/api/${role}/dashboard`, authenticated, (req, res) => {
    if (req.user.role !== role) return res.status(403).json({ error: 'This page is for a different role.' });
    res.json({ message: `Welcome to your ${role} dashboard.`, approvalRole: req.user.approvalRole || null });
  });
  function signedEvent(request, action, role, actor, note) {
    const createdAt = new Date(now()).toISOString();
    const payload = [request.token, action, role || '', actor.email, createdAt, note].join('\n');
    return { action, role, actorName: actor.name, actorEmail: actor.email, note, createdAt, signature: crypto.createHmac('sha256', config.secret).update(payload).digest('hex') };
  }
  app.post('/api/student/requests', authenticated, async (req, res, next) => {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'This page is for students.' });
    const { leaveType, startDate, endDate, destination, reason } = req.body;
    const start = new Date(startDate), end = new Date(endDate);
    if (!['Hostel leave', 'Academic outpass'].includes(leaveType) || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start || !String(destination || '').trim() || !String(reason || '').trim() || String(destination).length > 160 || String(reason).length > 2000) {
      return res.status(400).json({ error: 'Provide a valid leave type, date range, destination, and reason.' });
    }
    try {
      const token = `AIT-${new Date(now()).getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const request = new leaveRequests({
        token, studentEmail: req.user.email, studentName: req.user.name, leaveType,
        startDate: start, endDate: end, destination: String(destination).trim(), reason: String(reason).trim(),
        currentStage: approvalRoles[0],
      });
      request.timeline.push(signedEvent(request, 'submitted', null, req.user, 'Leave request submitted'));
      await request.save();
      res.status(201).json({ request });
    } catch (error) { next(error); }
  });
  app.get('/api/student/requests', authenticated, async (req, res, next) => {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'This page is for students.' });
    try { res.json({ requests: await leaveRequests.find({ studentEmail: req.user.email }).sort({ createdAt: -1 }).lean() }); }
    catch (error) { next(error); }
  });
  app.get('/api/faculty/requests', authenticated, async (req, res, next) => {
    if (req.user.role !== 'faculty' || !approvalRoles.includes(req.user.approvalRole)) return res.status(403).json({ error: 'Your account is not assigned to an approval stage.' });
    try {
      const query = req.query.view === 'approved'
        ? { status: 'approved' }
        : { status: 'pending', currentStage: req.user.approvalRole };
      res.json({ requests: await leaveRequests.find(query).sort({ createdAt: -1 }).lean() });
    } catch (error) { next(error); }
  });
  app.get('/api/faculty/logs', authenticated, async (req, res, next) => {
    if (req.user.role !== 'faculty' || !approvalRoles.includes(req.user.approvalRole)) return res.status(403).json({ error: 'Your account is not assigned to an approval stage.' });
    try {
      const requests = await leaveRequests.find({ 'timeline.actorEmail': req.user.email }).sort({ updatedAt: -1 }).lean();
      const logs = requests.flatMap(request => request.timeline.filter(event => event.actorEmail === req.user.email).map(event => ({ ...event, token: request.token, studentName: request.studentName, leaveType: request.leaveType })));
      res.json({ logs });
    } catch (error) { next(error); }
  });
  app.post('/api/faculty/requests/:id/respond', authenticated, async (req, res, next) => {
    if (req.user.role !== 'faculty' || !approvalRoles.includes(req.user.approvalRole)) return res.status(403).json({ error: 'Your account is not assigned to an approval stage.' });
    const { action, note = '' } = req.body;
    if (!['approved', 'rejected', 'needs_information'].includes(action)) return res.status(400).json({ error: 'Choose approve, reject, or request more information.' });
    if (typeof note !== 'string' || note.length > 1000 || (action !== 'approved' && !note.trim())) return res.status(400).json({ error: 'Add a short note for this response.' });
    try {
      const request = await leaveRequests.findOne({ _id: req.params.id, status: 'pending', currentStage: req.user.approvalRole });
      if (!request) return res.status(404).json({ error: 'This request is no longer awaiting your response.' });
      const event = signedEvent(request, action, req.user.approvalRole, req.user, note.trim());
      request.timeline.push(event);
      if (action === 'approved') {
        request.currentStage = nextApprovalRole(req.user.approvalRole);
        if (!request.currentStage) request.status = 'approved';
      } else if (action === 'rejected') {
        request.status = 'rejected';
        request.currentStage = null;
      }
      await request.save();
      res.json({ request });
    } catch (error) {
      if (error.name === 'VersionError') return res.status(409).json({ error: 'This request was updated by another reviewer. Refresh and try again.' });
      next(error);
    }
  });
  app.use('/api', require('./applications').routes(authenticated));
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
