require('dotenv').config({ quiet: true });
const User = require('./User');
async function seed() {
  const domain = (process.env.COLLEGE_DOMAIN || 'aitpune.edu.in').toLowerCase();
  for (const name of ['Medical', 'Personal', 'Family Emergency', 'Other']) await require('./Application').LeaveType.updateOne({ name }, { $setOnInsert: { name, active: true } }, { upsert: true });
  const Approver = require('./Approver');
  const departments = ['Computer Engineering', 'Information Technology', 'Electronics', 'Mechanical Engineering', 'Applied Sciences'];
  const entries = [['COUNSELOR', 'class_teacher', 10, 'class.teacher'], ['HOD', 'hod', 5, 'hod'], ['WARDEN', 'warden', 10, 'warden'], ['DIRECTOR', 'director', 1, 'director']];
  for (const [role, claim, count, prefix] of entries) {
    for (let i = 0; i < count; i++) {
      const suffix = i ? `.${String.fromCharCode(97 + i)}` : '';
      const email = `${prefix}${suffix}@${domain}`;
      const name = `Demo ${role === 'COUNSELOR' ? 'Counselor' : role === 'HOD' ? 'HOD' : role === 'WARDEN' ? 'Warden' : 'Director'} ${String.fromCharCode(65 + i)}`;
      const department = role === 'DIRECTOR' ? 'Administration' : departments[i % departments.length];
      await User.updateOne({ email }, { $setOnInsert: { email, role: 'faculty', approver_role: claim, name, college_id: `DEMO-${role}-${i}` } }, { upsert: true });
      const user = await User.findOne({ email });
      await Approver.updateOne({ contact_email: email }, { $setOnInsert: { user_id: String(user._id), contact_email: email, name, role, department, active: true } }, { upsert: true });
    }
  }
  for (const role of ['student', 'faculty']) {
    await User.updateOne({ email: `${role}${role === 'student' ? '_123456' : ''}@${domain}` }, { $setOnInsert: { email: `${role}${role === 'student' ? '_123456' : ''}@${domain}`, role, name: `Demo ${role}`, college_id: `DEMO-${role}` } }, { upsert: true });
  }
  const approvers = [
    ['warden', 'Warden'],
    ['counsellor', 'Counsellor'],
    ['hod', 'Head of Department'],
    ['joint_director', 'Joint Director'],
  ];
  for (const [approvalRole, name] of approvers) {
    const email = `${approvalRole}@${domain}`;
    await User.updateOne({ email }, {
      $set: { role: 'faculty', approval_role: approvalRole },
      $setOnInsert: { email, name: `Demo ${name}`, college_id: `DEMO-${approvalRole.toUpperCase()}` },
    }, { upsert: true });
  }
}
if (require.main === module) require('./database')().then(seed).then(() => process.exit(0)).catch(() => { console.error('Seed failed. Check database configuration.'); process.exit(1); });
module.exports = seed;
