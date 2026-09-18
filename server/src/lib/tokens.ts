import { randomBytes } from 'node:crypto'

/** Cryptographically secure invitation token (~192 bits). */
export function generateInviteToken(): string {
  return randomBytes(24).toString('base64url')
}

export function invitationPublicUrl(token: string, baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/i/${token}`
}
