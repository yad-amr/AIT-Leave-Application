const config = require('./config')()
const { createApp } = require('./auth')

require('./database')()
  .then(async () => {
    await require('./User').migrateLegacyApproverRoles()
    if (config.devMode) await require('./seed')()
    const app = createApp({ config, users: require('./User') })
    app.listen(process.env.PORT || 3001, '127.0.0.1', () => {
      console.log(`Smart Leave API listening on port ${process.env.PORT || 3001}`)
    })
  })
  .catch((error) => {
    console.error('Startup failed. Check database configuration.', error.message)
    process.exit(1)
  })
