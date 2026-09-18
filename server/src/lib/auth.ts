import * as argon2 from 'argon2'
import { SignJWT, jwtVerify } from 'jose'
import { env } from '../config/env.js'

const encoder = new TextEncoder()

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id })
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password)
  } catch {
    return false
  }
}

export type AdminSessionPayload = {
  sub: string
  email: string
}

export async function signAdminToken(payload: AdminSessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encoder.encode(env.JWT_SECRET))
}

export async function verifyAdminToken(token: string): Promise<AdminSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encoder.encode(env.JWT_SECRET))
    if (!payload.sub || typeof payload.email !== 'string') return null
    return { sub: payload.sub, email: payload.email }
  } catch {
    return null
  }
}
