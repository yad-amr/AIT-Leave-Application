require('dotenv').config({ quiet: true });
const User = require('./User');
async function seed() {
  const domain = (process.env.COLLEGE_DOMAIN || 'aitpune.edu.in').toLowerCase();
  await User.updateOne({ email: `student_123456@${domain}` }, { $setOnInsert: { email: `student_123456@${domain}`, role: 'student', name: 'Demo student', college_id: 'DEMO-STUDENT' } }, { upsert: true });
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
