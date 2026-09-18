import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import { env } from './config/env.js'
import { errorHandler } from './lib/errors.js'
import { invitationsRouter } from './routes/invitations.js'
import { authRouter } from './routes/auth.js'
import { adminRouter } from './routes/admin.js'
import { uploadsDir, uploadsRouter } from './routes/uploads.js'

export function createApp() {
  const app = express()

  app.set('trust proxy', 1)
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser())
  app.use('/uploads', express.static(uploadsDir, { maxAge: '7d' }))

  const publicLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
  })

  const rsvpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
  })

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
  })

  app.use('/api/admin/auth/login', authLimiter)
  app.use('/api/admin/auth', authRouter)
  app.use('/api/admin/uploads', uploadsRouter)
  app.use('/api/admin', adminRouter)
  app.use('/api/invitations/:token/rsvp', rsvpLimiter)
  app.use('/api/invitations', publicLimiter, invitationsRouter)

  app.use(errorHandler)
  return app
}
