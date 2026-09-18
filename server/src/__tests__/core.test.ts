import { describe, expect, it } from 'vitest'
import { generateInviteToken } from '../lib/tokens.js'
import { validateGuestCount } from '../services/rsvpService.js'
import { AppError } from '../lib/errors.js'
import { buildWhatsAppInviteMessage } from '../services/whatsappService.js'
import { sanitizeMessage } from '../lib/sanitize.js'

describe('invite tokens', () => {
  it('generates unique unguessable tokens', () => {
    const a = generateInviteToken()
    const b = generateInviteToken()
    expect(a).not.toEqual(b)
    expect(a.length).toBeGreaterThanOrEqual(24)
  })
})

describe('RSVP guest count validation', () => {
  it('forces 0 when not attending', () => {
    expect(validateGuestCount('NOT_ATTENDING', 5, 4)).toBe(0)
  })

  it('allows counts within max', () => {
    expect(validateGuestCount('ATTENDING', 3, 4)).toBe(3)
  })

  it('rejects counts above max', () => {
    expect(() => validateGuestCount('ATTENDING', 5, 4)).toThrow(AppError)
  })

  it('rejects zero when attending', () => {
    expect(() => validateGuestCount('ATTENDING', 0, 4)).toThrow(AppError)
  })
})

describe('whatsapp messages', () => {
  it('localizes prefilled text', () => {
    expect(buildWhatsAppInviteMessage({ language: 'EN', fullName: 'John', inviteUrl: 'https://x/i/a' })).toContain(
      'Dear John',
    )
    expect(buildWhatsAppInviteMessage({ language: 'AR', fullName: 'John', inviteUrl: 'https://x/i/a' })).toContain(
      'دعوتكم الشخصية',
    )
    expect(buildWhatsAppInviteMessage({ language: 'HE', fullName: 'John', inviteUrl: 'https://x/i/a' })).toContain(
      'ההזמנה האישית',
    )
  })
})

describe('sanitize', () => {
  it('strips html and truncates', () => {
    const raw = `<script>alert(1)</script>${'x'.repeat(600)}`
    const cleaned = sanitizeMessage(raw)
    expect(cleaned).not.toContain('<script>')
    expect(cleaned.length).toBeLessThanOrEqual(500)
  })
})
