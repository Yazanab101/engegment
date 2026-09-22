import { randomBytes } from 'node:crypto'

/** Cryptographically secure invitation token (~192 bits). */
export function generateInviteToken(): string {
  return randomBytes(24).toString('base64url')
}

export function invitationPublicUrl(
  token: string,
  baseUrl: string,
  language?: string | null,
): string {
  const url = `${baseUrl.replace(/\/$/, '')}/i/${token}`
  const lang =
    language === 'HE' ? 'he' : language === 'AR' ? 'ar' : language === 'EN' ? 'en' : null
  return lang ? `${url}?lang=${lang}` : url
}
