require('dotenv').config({ quiet: true })
const bcrypt = require('bcrypt')
const User = require('./User')
const LeaveType = require('./models/LeaveType')

async function seed() {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo users cannot be seeded in production.')
  const domain = (process.env.COLLEGE_DOMAIN || 'aitpune.edu.in').toLowerCase()
  const demoPassword = process.env.DEMO_PASSWORD || 'CampusLeave123!'
  const passwordHash = await bcrypt.hash(demoPassword, 12)
  await User.migrateLegacyApproverRoles()
  for (const name of ['Personal leave', 'Medical leave', 'Academic leave', 'Family emergency', 'Other']) {
    await LeaveType.updateOne({ name }, { $setOnInsert: { name, active: true } }, { upsert: true })
  }
  // Remove approval stages from the earlier generic local demo reviewers.
  await User.updateMany(
    { email: { $in: [`warden@${domain}`, `counsellor@${domain}`, `hod@${domain}`, `jointdirector@${domain}`] } },
    { $unset: { approvalRole: 1 } },
  )
  const demos = [
    { email: `aarav.sharma_240101@${domain}`, role: 'student', name: 'Aarav Sharma', college_id: 'DEMO-240101' },
    { email: `ananya.iyer_240102@${domain}`, role: 'student', name: 'Ananya Iyer', college_id: 'DEMO-240102' },
    { email: `rohan.mehta_240103@${domain}`, role: 'student', name: 'Rohan Mehta', college_id: 'DEMO-240103' },
    { email: `priya.nair_240104@${domain}`, role: 'student', name: 'Priya Nair', college_id: 'DEMO-240104' },
    { email: `kabir.patel_240105@${domain}`, role: 'student', name: 'Kabir Patel', college_id: 'DEMO-240105' },
    { email: `meera.joshi_240106@${domain}`, role: 'student', name: 'Meera Joshi', college_id: 'DEMO-240106' },
    { email: `ishaan.kulkarni_240107@${domain}`, role: 'student', name: 'Ishaan Kulkarni', college_id: 'DEMO-240107' },
    { email: `sana.khan_240108@${domain}`, role: 'student', name: 'Sana Khan', college_id: 'DEMO-240108' },
    { email: `dev.malhotra_240109@${domain}`, role: 'student', name: 'Dev Malhotra', college_id: 'DEMO-240109' },
    { email: `tara.desai_240110@${domain}`, role: 'student', name: 'Tara Desai', college_id: 'DEMO-240110' },
    { email: `faculty@${domain}`, role: 'faculty', name: 'Demo Faculty', college_id: 'DEMO-FACULTY' },
    { email: `nisha.rao@${domain}`, role: 'faculty', approvalRole: 'warden', name: 'Nisha Rao', college_id: 'DEMO-WARDEN-1' },
    { email: `rahul.shah@${domain}`, role: 'faculty', approvalRole: 'warden', name: 'Rahul Shah', college_id: 'DEMO-WARDEN-2' },
    { email: `anjali.desai@${domain}`, role: 'faculty', approvalRole: 'counsellor', name: 'Anjali Desai', college_id: 'DEMO-COUNSELLOR-1' },
    { email: `arjun.kulkarni@${domain}`, role: 'faculty', approvalRole: 'counsellor', name: 'Arjun Kulkarni', college_id: 'DEMO-COUNSELLOR-2' },
    { email: `sneha.patil@${domain}`, role: 'faculty', approvalRole: 'hod', name: 'Sneha Patil', college_id: 'DEMO-HOD-1' },
    { email: `vikram.menon@${domain}`, role: 'faculty', approvalRole: 'hod', name: 'Vikram Menon', college_id: 'DEMO-HOD-2' },
    { email: `vivek.desai@${domain}`, role: 'faculty', approvalRole: 'joint_director', name: 'Vivek Desai', college_id: 'DEMO-JOINT-DIRECTOR' },
  ]

  const departments = { warden: 'Hostel Administration', counsellor: 'Student Counselling', hod: 'Computer Engineering', joint_director: 'College Administration' }
  for (const demo of demos) {
    demo.active = true
    if (demo.approvalRole) demo.department = departments[demo.approvalRole]
  }

  for (const demo of demos) {
    if (demo.approvalRole === 'joint_director') {
      const existingDirector = await User.findOne({ approvalRole: 'joint_director' })
      if (existingDirector && existingDirector.email !== demo.email) continue
    }
    const user = await User.findOne({ email: demo.email }).select('+passwordHash')
    if (!user) {
      await User.create({ ...demo, passwordHash })
      continue
    }
    const updates = { ...demo }
    if (!user.passwordHash) updates.passwordHash = passwordHash
    await User.updateOne({ _id: user._id }, { $set: updates })
  }
}

if (require.main === module) {
  require('./database')().then(seed).then(() => process.exit(0)).catch((error) => {
    console.error('Seed failed. Check database configuration.', error.message)
    process.exit(1)
  })
}

module.exports = seed
