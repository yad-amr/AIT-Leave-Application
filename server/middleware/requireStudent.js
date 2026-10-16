function requireStudent(req, res, next) {
  // Authentication must run before this middleware and set req.user.
  // The auth middleware is mounted before this route and supplies the JWT subject as req.user.sub.
  if (!req.user) {
    return res.status(401).json({ message: 'Please sign in to continue.' })
  }

  const role = String(req.user.role || '').toLowerCase()
  if (role !== 'student') {
    return res.status(403).json({ message: 'Only students can access these leave requests.' })
  }

  const studentId = req.user.id || req.user._id || req.user.userId || req.user.sub
  if (!studentId) {
    return res.status(401).json({ message: 'Your account is missing a student ID.' })
  }

  next()
}

module.exports = { requireStudent }
