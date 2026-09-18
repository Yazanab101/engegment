import type { NextFunction, Request, Response } from 'express'
import { env } from '../config/env.js'
import { verifyAdminToken } from '../lib/auth.js'
import { AppError } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'

export type AuthedRequest = Request & {
  admin?: { id: string; email: string }
}

export async function requireAdmin(req: AuthedRequest, _res: Response, next: NextFunction) {
  const token = req.cookies?.[env.COOKIE_NAME]
  if (!token) {
    next(new AppError(401, 'Unauthorized', 'UNAUTHORIZED'))
    return
  }

  const payload = await verifyAdminToken(token)
  if (!payload) {
    next(new AppError(401, 'Unauthorized', 'UNAUTHORIZED'))
    return
  }

  const admin = await prisma.adminUser.findUnique({ where: { id: payload.sub } })
  if (!admin) {
    next(new AppError(401, 'Unauthorized', 'UNAUTHORIZED'))
    return
  }

  req.admin = { id: admin.id, email: admin.email }
  next()
}
