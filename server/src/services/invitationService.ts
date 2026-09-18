import type { InvitationEventType, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { env } from '../config/env.js'
import { AppError } from '../lib/errors.js'

export async function getCurrentEvent() {
  const event = await prisma.event.findUnique({ where: { slug: 'current' } })
  if (!event) throw new AppError(404, 'Event not configured', 'EVENT_MISSING')
  return event
}

export async function findGuestByToken(token: string) {
  return prisma.guest.findUnique({
    where: { inviteToken: token },
    include: { rsvp: true, event: true },
  })
}

export async function requireActiveGuestByToken(token: string) {
  const guest = await findGuestByToken(token)
  if (!guest || !guest.isActive) {
    throw new AppError(404, 'Invitation not found', 'INVITATION_NOT_FOUND')
  }
  return guest
}

/**
 * Records an invitation open with deduplication:
 * refreshes within OPEN_DEDUP_MINUTES do not increment openCount
 * or create a new INVITATION_OPENED event.
 */
export async function recordInvitationOpen(guestId: string) {
  const now = new Date()
  const windowMs = env.OPEN_DEDUP_MINUTES * 60 * 1000

  return prisma.$transaction(async (tx) => {
    const recent = await tx.invitationEvent.findFirst({
      where: {
        guestId,
        type: 'INVITATION_OPENED',
        createdAt: { gte: new Date(now.getTime() - windowMs) },
      },
    })

    if (recent) {
      await tx.guest.update({
        where: { id: guestId },
        data: { lastOpenedAt: now },
      })
      return { counted: false as const }
    }

    const guest = await tx.guest.findUniqueOrThrow({ where: { id: guestId } })

    await tx.guest.update({
      where: { id: guestId },
      data: {
        firstOpenedAt: guest.firstOpenedAt ?? now,
        lastOpenedAt: now,
        openCount: { increment: 1 },
        invitationStatus: guest.invitationStatus === 'CREATED' ? 'OPENED' : guest.invitationStatus,
      },
    })

    await tx.invitationEvent.create({
      data: { guestId, type: 'INVITATION_OPENED' },
    })

    return { counted: true as const }
  })
}

export async function logGuestEvent(
  guestId: string,
  type: InvitationEventType,
  metadata?: Prisma.InputJsonValue,
) {
  return prisma.invitationEvent.create({
    data: { guestId, type, metadata },
  })
}
