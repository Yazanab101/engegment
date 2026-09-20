import { createApp } from './app.js'
import { env } from './config/env.js'
import { ensureR2Cors } from './memories/r2.js'
import { ensureBootstrapAdmin } from './routes/auth.js'

async function main() {
  await ensureBootstrapAdmin()
  try {
    await ensureR2Cors()
  } catch (error) {
    console.error('R2 CORS update failed', error instanceof Error ? error.message : error)
  }
  const app = createApp()
  app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
