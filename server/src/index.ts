import { createApp } from './app.js'
import { env } from './config/env.js'
import { ensureBootstrapAdmin } from './routes/auth.js'

async function main() {
  await ensureBootstrapAdmin()
  const app = createApp()
  app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
