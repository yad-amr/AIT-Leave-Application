const config = require('./config')()
const { createApp } = require('./auth')
const path = require('node:path')
const fs = require('node:fs')

const clientBuild = path.resolve(__dirname, '../client/dist/index.html')
if (config.production && !fs.existsSync(clientBuild)) {
  console.error('Production client build is missing. Run the project build before starting the server.')
  process.exit(1)
}

require('./database')(config.mongoUri)
  .then(async () => {
    await require('./User').migrateLegacyApproverRoles()
    if (config.devMode) await require('./seed')()
    const app = createApp({ config, users: require('./User') })
    app.listen(process.env.PORT || 3001, process.env.HOST || (config.production ? '0.0.0.0' : '127.0.0.1'), () => {
      console.log(`Smart Leave API listening on port ${process.env.PORT || 3001}`)
    })
  })
  .catch((error) => {
    console.error('Startup failed. Check database configuration.', error.message)
    process.exit(1)
  })
