import type { InvitationEventType, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { composeGuestDisplayName } from '../lib/guestDisplayName.js'
import { getCurrentEvent } from './invitationService.js'

const NOTIFICATION_TYPES: InvitationEventType[] = [
  'RSVP_ATTENDING',
  'RSVP_NOT_ATTENDING',
  'RSVP_UPDATED',
  'INVITATION_OPENED',
]

type EventMeta = {
  status?: string
  guestCount?: number
  message?: string | null
  source?: string
}

export type AdminNotification = {
  id: string
  eventId: string
  kind: 'attending' | 'not_attending' | 'updated' | 'message' | 'opened'
  createdAt: string
  guestId: string
  guestName: string
  title: string
  body: string
  guestCount: number | null
  message: string | null
  href: string
}

function asMeta(value: Prisma.JsonValue | null): EventMeta {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as EventMeta
}

export async function listAdminNotifications(limit = 40): Promise<{
  items: AdminNotification[]
  latestAt: string | null
}> {
  const event = await getCurrentEvent()
  const take = Math.min(100, Math.max(1, limit))

  const rows = await prisma.invitationEvent.findMany({
    where: {
      type: { in: NOTIFICATION_TYPES },
      guest: { eventId: event.id },
    },
    include: {
      guest: {
        select: {
          id: true,
          fullName: true,
          language: true,
          titleKey: true,
          includeFamily: true,
          familySuffixKey: true,
          rsvp: { select: { guestCount: true, message: true, status: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: take * 2,
  })

  const items: AdminNotification[] = []
  const messageGuests = new Set<string>()

  for (const row of rows) {
    const meta = asMeta(row.metadata)
    if (meta.source === 'admin') continue

    const guestName = composeGuestDisplayName({
      fullName: row.guest.fullName,
      language: row.guest.language,
      titleKey: row.guest.titleKey,
      includeFamily: row.guest.includeFamily,
      familySuffixKey: row.guest.familySuffixKey,
    })
    const guestCount =
      typeof meta.guestCount === 'number'
        ? meta.guestCount
        : row.guest.rsvp?.guestCount ?? null
    const messageFromMeta =
      typeof meta.message === 'string' && meta.message.trim()
        ? meta.message.trim()
        : null
    const messageFromRsvp =
      !messageFromMeta &&
      !messageGuests.has(row.guestId) &&
      row.type !== 'INVITATION_OPENED' &&
      row.guest.rsvp?.message?.trim()
        ? row.guest.rsvp.message.trim()
        : null
    const message = messageFromMeta || messageFromRsvp
    const createdAt = row.createdAt.toISOString()
    const baseHref = `/admin/guests?guest=${row.guestId}`

    if (row.type === 'INVITATION_OPENED') {
      items.push({
        id: `${row.id}:opened`,
        eventId: row.id,
        kind: 'opened',
        createdAt,
        guestId: row.guestId,
        guestName,
        title: 'فتح الدعوة',
        body: `${guestName} فتح الدعوة`,
        guestCount: null,
        message: null,
        href: baseHref,
      })
    } else if (row.type === 'RSVP_ATTENDING') {
      items.push({
        id: `${row.id}:attending`,
        eventId: row.id,
        kind: 'attending',
        createdAt,
        guestId: row.guestId,
        guestName,
        title: 'وافق يحضر',
        body:
          guestCount && guestCount > 0
            ? `${guestName} وافق يحضر — ${guestCount} أشخاص`
            : `${guestName} وافق يحضر`,
        guestCount,
        message: null,
        href: baseHref,
      })
    } else if (row.type === 'RSVP_NOT_ATTENDING') {
      items.push({
        id: `${row.id}:declined`,
        eventId: row.id,
        kind: 'not_attending',
        createdAt,
        guestId: row.guestId,
        guestName,
        title: 'رفض الحضور',
        body: `${guestName} مش جاي`,
        guestCount: 0,
        message: null,
        href: baseHref,
      })
    } else if (row.type === 'RSVP_UPDATED') {
      const attending = meta.status === 'ATTENDING' || row.guest.rsvp?.status === 'ATTENDING'
      items.push({
        id: `${row.id}:updated`,
        eventId: row.id,
        kind: attending ? 'attending' : 'updated',
        createdAt,
        guestId: row.guestId,
        guestName,
        title: attending ? 'عدّل الحضور' : 'عدّل الرد',
        body: attending
          ? `${guestName} عدّل الحضور — ${guestCount ?? 0} أشخاص`
          : `${guestName} عدّل الرد إلى مش جاي`,
        guestCount: attending ? guestCount : 0,
        message: null,
        href: baseHref,
      })
    }

    if (message && row.type !== 'INVITATION_OPENED') {
      messageGuests.add(row.guestId)
      items.push({
        id: `${row.id}:message`,
        eventId: row.id,
        kind: 'message',
        createdAt,
        guestId: row.guestId,
        guestName,
        title: 'رسالة جديدة',
        body: `${guestName}: ${message}`,
        guestCount: null,
        message,
        href: `${baseHref}&message=1`,
      })
    }

    if (items.length >= take) break
  }

  return {
    items: items.slice(0, take),
    latestAt: items[0]?.createdAt ?? null,
  }
}
