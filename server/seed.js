require('dotenv').config({ quiet: true });
const User = require('./User');
async function seed() {
  const domain = (process.env.COLLEGE_DOMAIN || 'ait.edu').toLowerCase();
  for (const role of ['student', 'faculty', 'warden']) {
    await User.updateOne({ email: `${role}@${domain}` }, { $setOnInsert: { email: `${role}@${domain}`, role, name: `Demo ${role}`, college_id: `DEMO-${role}` } }, { upsert: true });
  }
}
if (require.main === module) require('./database')().then(seed).then(() => process.exit(0)).catch(() => { console.error('Seed failed. Check database configuration.'); process.exit(1); });
module.exports = seed;
