import type { RsvpStatus } from '@prisma/client'
import { z } from 'zod'
import { AppError } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { sanitizeMessage } from '../lib/sanitize.js'
import { logGuestEvent, requireActiveGuestByToken } from './invitationService.js'

export const rsvpBodySchema = z.object({
  status: z.enum(['ATTENDING', 'NOT_ATTENDING']),
  guestCount: z.number().int().min(0).max(50).optional(),
  message: z.string().max(500).optional().nullable(),
})

export type RsvpBody = z.infer<typeof rsvpBodySchema>

export function validateGuestCount(
  status: 'ATTENDING' | 'NOT_ATTENDING',
  guestCount: number | undefined,
  maxGuestsAllowed: number,
): number {
  if (status === 'NOT_ATTENDING') return 0

  const count = guestCount ?? 1
  if (count < 1) {
    throw new AppError(400, 'At least 1 guest is required when attending', 'INVALID_GUEST_COUNT')
  }
  if (count > maxGuestsAllowed) {
    throw new AppError(
      400,
      `Guest count cannot exceed ${maxGuestsAllowed}`,
      'GUEST_LIMIT_EXCEEDED',
    )
  }
  return count
}

export async function submitRsvp(token: string, body: RsvpBody, options?: { allowAfterDeadline?: boolean }) {
  const guest = await requireActiveGuestByToken(token)
  const event = guest.event

  if (!options?.allowAfterDeadline && event.rsvpDeadline && event.rsvpDeadline.getTime() < Date.now()) {
    throw new AppError(403, 'RSVP updates are now closed', 'RSVP_CLOSED')
  }

  const guestCount = validateGuestCount(body.status, body.guestCount, guest.maxGuestsAllowed)
  const message = body.message ? sanitizeMessage(body.message) : null
  const now = new Date()
  const previous = guest.rsvp

  const rsvp = await prisma.rsvp.upsert({
    where: { guestId: guest.id },
    create: {
      guestId: guest.id,
      status: body.status,
      guestCount,
      message,
      submittedAt: now,
    },
    update: {
      status: body.status,
      guestCount,
      message,
      submittedAt: previous?.submittedAt ?? now,
    },
  })

  await prisma.guest.update({
    where: { id: guest.id },
    data: { invitationStatus: 'RESPONDED' },
  })

  const eventType =
    previous && previous.status !== 'PENDING'
      ? 'RSVP_UPDATED'
      : body.status === 'ATTENDING'
        ? 'RSVP_ATTENDING'
        : 'RSVP_NOT_ATTENDING'

  await logGuestEvent(guest.id, eventType, {
    status: body.status,
    guestCount,
  })

  return rsvp
}

export async function adminSetRsvp(
  guestId: string,
  data: { status: RsvpStatus; guestCount?: number; message?: string | null },
) {
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    include: { rsvp: true },
  })
  if (!guest) throw new AppError(404, 'Guest not found')

  if (data.status === 'PENDING') {
    if (guest.rsvp) {
      await prisma.rsvp.update({
        where: { guestId },
        data: { status: 'PENDING', guestCount: 0, message: data.message ?? null },
      })
    }
    await prisma.guest.update({
      where: { id: guestId },
      data: {
        invitationStatus: guest.openCount > 0 || guest.firstOpenedAt ? 'OPENED' : 'CREATED',
      },
    })
    return
  }

  const count = validateGuestCount(
    data.status as 'ATTENDING' | 'NOT_ATTENDING',
    data.guestCount,
    guest.maxGuestsAllowed,
  )
  const message = data.message ? sanitizeMessage(data.message) : data.message === null ? null : undefined
  const now = new Date()

  await prisma.rsvp.upsert({
    where: { guestId },
    create: {
      guestId,
      status: data.status,
      guestCount: count,
      message: message ?? null,
      submittedAt: now,
    },
    update: {
      status: data.status,
      guestCount: count,
      ...(message !== undefined ? { message } : {}),
      submittedAt: guest.rsvp?.submittedAt ?? now,
    },
  })

  await prisma.guest.update({
    where: { id: guestId },
    data: { invitationStatus: 'RESPONDED' },
  })

  await logGuestEvent(guestId, 'RSVP_UPDATED', { status: data.status, guestCount: count, source: 'admin' })
}
