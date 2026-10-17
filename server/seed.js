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
  await User.deleteMany({
    email: {
      $in: [
        `nisha.rao@${domain}`,
        `rahul.shah@${domain}`,
        `sneha.patil@${domain}`,
        `vikram.menon@${domain}`,
        `vivek.desai@${domain}`,
      ],
    },
  })
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
    { email: `sandip.shivaji.mahadik_rectorboyshostel@${domain}`, role: 'faculty', name: 'Sandip Shivaji Mahadik', department: 'Boys Hostel', college_id: 'DEMO-RECTOR-BOYS-HOSTEL' },
    { email: `beauty.das_wardengirlshostel@${domain}`, role: 'faculty', approvalRole: 'warden', name: 'Ms. Beauty Das', department: 'Girls Hostel', college_id: 'DEMO-WARDEN-GIRLS-HOSTEL' },
    { email: `dhanjee.singh.yadav_supervisorboyshostel@${domain}`, role: 'faculty', name: 'Mr. Dhanjee Singh Yadav', department: 'Boys Hostel', college_id: 'DEMO-SUPERVISOR-BOYS-HOSTEL-1' },
    { email: `r.s.talikoti_supervisorboyshostel@${domain}`, role: 'faculty', name: 'Mr. R S Talikoti', department: 'Boys Hostel', college_id: 'DEMO-SUPERVISOR-BOYS-HOSTEL-2' },
    { email: `amol.tejrao.mogal_supervisorboyshostel@${domain}`, role: 'faculty', name: 'Mr. Amol Tejrao Mogal', department: 'Boys Hostel', college_id: 'DEMO-SUPERVISOR-BOYS-HOSTEL-3' },
    { email: `umesh.kumar.singh_wardenboyshostel@${domain}`, role: 'faculty', approvalRole: 'warden', name: 'Mr. Umesh Kumar Singh', department: 'Boys Hostel', college_id: 'DEMO-WARDEN-BOYS-HOSTEL-1' },
    { email: `kajal.khatri_wardenboyshostel@${domain}`, role: 'faculty', approvalRole: 'warden', name: 'Mr. Kajal Khatri', department: 'Boys Hostel', college_id: 'DEMO-WARDEN-BOYS-HOSTEL-2' },
    { email: `mangesh.uttam.amberkar_wardenboyshostel@${domain}`, role: 'faculty', approvalRole: 'warden', name: 'Mr. Mangesh Uttam Amberkar', department: 'Boys Hostel', college_id: 'DEMO-WARDEN-BOYS-HOSTEL-3' },
    { email: `vikas.d.ambre_wardenboyshostel@${domain}`, role: 'faculty', approvalRole: 'warden', name: 'Mr Vikas D Ambre', department: 'Boys Hostel', college_id: 'DEMO-WARDEN-BOYS-HOSTEL-4' },
    { email: `anjali.desai@${domain}`, role: 'faculty', approvalRole: 'counsellor', name: 'Anjali Desai', college_id: 'DEMO-COUNSELLOR-1' },
    { email: `arjun.kulkarni@${domain}`, role: 'faculty', approvalRole: 'counsellor', name: 'Arjun Kulkarni', college_id: 'DEMO-COUNSELLOR-2' },
    { email: `sushma.patil_hodentc@${domain}`, role: 'faculty', approvalRole: 'hod', name: 'Dr Sushma Patil', department: 'E&TC', college_id: 'DEMO-HOD-ENTC' },
    { email: `s.r.dhore_hodcomputerengg@${domain}`, role: 'faculty', approvalRole: 'hod', name: 'Prof.(Dr.) S R Dhore', department: 'Computer Engineering', college_id: 'DEMO-HOD-COMPUTER-ENGG' },
    { email: `sangeeta.jadhav_hodit@${domain}`, role: 'faculty', approvalRole: 'hod', name: 'Dr. (Mrs) Sangeeta Jadhav', department: 'Information Technology', college_id: 'DEMO-HOD-IT' },
    { email: `u.v.awasarmol_hodmechanicalengg@${domain}`, role: 'faculty', approvalRole: 'hod', name: 'Prof (Dr) UV Awasarmol', department: 'Mechanical Engineering', college_id: 'DEMO-HOD-MECHANICAL-ENGG' },
    { email: `j.d.patil_hodare@${domain}`, role: 'faculty', approvalRole: 'hod', name: 'Dr J D Patil', department: 'ARE', college_id: 'DEMO-HOD-ARE' },
    { email: `sudip.khasnavis_jointdirector@${domain}`, role: 'faculty', approvalRole: 'joint_director', name: 'Col Sudip Khasnavis (Retd)', department: 'College Administration', college_id: 'DEMO-JOINT-DIRECTOR' },
  ]

  const departments = { counsellor: 'Student Counselling' }
  for (const demo of demos) {
    demo.active = true
    if (demo.approvalRole && departments[demo.approvalRole]) demo.department = departments[demo.approvalRole]
  }

  for (const demo of demos) {
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
