const config = require('./config')();
const { createApp, mailer } = require('./auth');
require('./database')().then(async () => {
  if (config.devMode) await require('./seed')();
  createApp({ config, users: require('./User'), sendMail: mailer(config) }).listen(process.env.PORT || 3001, '127.0.0.1', () => console.log('Auth API listening on port ' + (process.env.PORT || 3001)));
}).catch(() => { console.error('Startup failed. Check database configuration.'); process.exit(1); });
