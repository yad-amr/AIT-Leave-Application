require('dotenv').config({ quiet: true });
const User = require('./User');
async function seed() {
  const domain = (process.env.COLLEGE_DOMAIN || 'aitpune.edu.in').toLowerCase();
  for (const name of ['Medical', 'Personal', 'Family Emergency', 'Other']) await require('./Application').LeaveType.updateOne({ name }, { $setOnInsert: { name, active: true } }, { upsert: true });
  for (const role of ['class_teacher', 'hod', 'warden', 'director']) {
    const email = `${role.replace('_', '.')}@${domain}`;
    await User.updateOne({ email }, { $set: { email, role: 'faculty', approver_role: role, name: `Demo ${role.replace('_', ' ')}`, college_id: `DEMO-${role}` } }, { upsert: true });
  }
  for (const role of ['student', 'faculty', 'warden']) {
    await User.updateOne({ email: `${role}${role === 'student' ? '_123456' : ''}@${domain}` }, { $setOnInsert: { email: `${role}${role === 'student' ? '_123456' : ''}@${domain}`, role, name: `Demo ${role}`, college_id: `DEMO-${role}` } }, { upsert: true });
  }
}
if (require.main === module) require('./database')().then(seed).then(() => process.exit(0)).catch(() => { console.error('Seed failed. Check database configuration.'); process.exit(1); });
module.exports = seed;
