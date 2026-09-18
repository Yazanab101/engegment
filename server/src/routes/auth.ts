import { Router } from 'express'
import { z } from 'zod'
import { env } from '../config/env.js'
import { hashPassword, signAdminToken, verifyPassword } from '../lib/auth.js'
import { asyncHandler, AppError } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { requireAdmin, type AuthedRequest } from '../middleware/auth.js'

export const authRouter = Router()

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
      })
      .parse(req.body)

    const admin = await prisma.adminUser.findUnique({ where: { email: body.email.toLowerCase() } })
    if (!admin || !(await verifyPassword(admin.passwordHash, body.password))) {
      throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS')
    }

    const token = await signAdminToken({ sub: admin.id, email: admin.email })
    res.cookie(env.COOKIE_NAME, token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      // Same-origin via Vercel /api proxy uses lax; cross-site direct API needs none.
      sameSite: process.env.COOKIE_SAME_SITE === 'none' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    })
    res.json({ id: admin.id, email: admin.email, name: admin.name })
  }),
)

authRouter.post(
  '/logout',
  asyncHandler(async (_req, res) => {
    res.clearCookie(env.COOKIE_NAME, { path: '/' })
    res.json({ ok: true })
  }),
)

authRouter.get(
  '/me',
  requireAdmin,
  asyncHandler(async (req: AuthedRequest, res) => {
    const admin = await prisma.adminUser.findUniqueOrThrow({ where: { id: req.admin!.id } })
    res.json({ id: admin.id, email: admin.email, name: admin.name })
  }),
)

/** Bootstrap first admin if none exists (uses env credentials once). */
export async function ensureBootstrapAdmin() {
  const count = await prisma.adminUser.count()
  if (count > 0) return
  if (!env.ADMIN_BOOTSTRAP_EMAIL || !env.ADMIN_BOOTSTRAP_PASSWORD) {
    console.warn('No admin users and no ADMIN_BOOTSTRAP_* credentials set')
    return
  }
  await prisma.adminUser.create({
    data: {
      email: env.ADMIN_BOOTSTRAP_EMAIL.toLowerCase(),
      passwordHash: await hashPassword(env.ADMIN_BOOTSTRAP_PASSWORD),
      name: 'Admin',
    },
  })
  console.log(`Bootstrap admin created: ${env.ADMIN_BOOTSTRAP_EMAIL}`)
}
