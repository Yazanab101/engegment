import { createApp } from './app.js'
import { env } from './config/env.js'
import { connectPrisma } from './lib/prisma.js'
import { ensureR2Cors } from './memories/r2.js'
import { ensureBootstrapAdmin, ensureLiveDashAdmin } from './routes/auth.js'

async function main() {
  const app = createApp()
  app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`)
  })

  // Warm DB after the HTTP server is already accepting requests.
  void (async () => {
    try {
      await connectPrisma()
      await ensureBootstrapAdmin()
      await ensureLiveDashAdmin()
    } catch (error) {
      console.error('DB bootstrap failed', error instanceof Error ? error.message : error)
    }
    try {
      await ensureR2Cors()
    } catch (error) {
      console.error('R2 CORS update failed', error instanceof Error ? error.message : error)
    }
  })()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
