import type { Guest, Language, Prisma, Rsvp, RsvpStatus } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { AppError } from '../lib/errors.js'
import { generateInviteToken, invitationPublicUrl } from '../lib/tokens.js'
import { env } from '../config/env.js'
import { getCurrentEvent, getCurrentEventCached } from './invitationService.js'
import { escapeCsvCell } from '../lib/sanitize.js'
import { composeGuestDisplayName } from '../lib/guestDisplayName.js'

export type GuestFilterValue =
  | 'all'
  | 'opened'
  | 'not_opened'
  | 'attending'
  | 'not_attending'
  | 'pending'
  | 'invite_sent'
  | 'invite_not_sent'
  | 'groom_family'
  | 'bride_family'
  | 'ar'
  | 'he'
  | 'en'

export type GuestListQuery = {
  page?: number
  pageSize?: number
  search?: string
  language?: Language
  filter?: GuestFilterValue
  filters?: GuestFilterValue[]
  sortBy?: 'fullName' | 'createdAt' | 'lastOpenedAt' | 'openCount'
  sortDir?: 'asc' | 'desc'
}

function deriveDisplayStatus(guest: Guest & { rsvp: Rsvp | null }) {
  if (guest.rsvp?.status === 'ATTENDING') return 'ATTENDING' as const
  if (guest.rsvp?.status === 'NOT_ATTENDING') return 'NOT_ATTENDING' as const
  if (guest.firstOpenedAt || guest.openCount > 0 || guest.invitationStatus === 'OPENED') {
    return 'OPENED_PENDING' as const
  }
  return 'NOT_OPENED' as const
}

export async function getDashboardStats() {
  const event = await getCurrentEventCached()
  const guests = await prisma.guest.findMany({
    where: { eventId: event.id },
    include: { rsvp: true },
  })

  const totalInvitationLinks = guests.length
  const totalInvitedPeople = guests.reduce((sum, g) => sum + g.maxGuestsAllowed, 0)
  const openedInvitations = guests.filter((g) => g.openCount > 0 || g.firstOpenedAt).length
  const notOpened = totalInvitationLinks - openedInvitations
  const attendingInvitations = guests.filter((g) => g.rsvp?.status === 'ATTENDING').length
  const notAttending = guests.filter((g) => g.rsvp?.status === 'NOT_ATTENDING').length
  const rsvpResponses = attendingInvitations + notAttending
  const pendingResponse = totalInvitationLinks - rsvpResponses
  const totalPeopleAttending = guests
    .filter((g) => g.rsvp?.status === 'ATTENDING')
    .reduce((sum, g) => sum + (g.rsvp?.guestCount ?? 0), 0)

  function guestSide(tags: string[]): 'groom' | 'bride' | 'none' {
    if (tags.includes('GROOM_FAMILY')) return 'groom'
    if (tags.includes('BRIDE_FAMILY')) return 'bride'
    return 'none'
  }

  const attendingGuests = guests
    .filter((g) => g.rsvp?.status === 'ATTENDING')
    .map((g) => {
      const side = guestSide(g.tags)
      return {
        id: g.id,
        name: composeGuestDisplayName({
          fullName: g.fullName,
          language: g.language,
          titleKey: g.titleKey,
          includeFamily: g.includeFamily,
          familySuffixKey: g.familySuffixKey,
        }),
        side,
        sideLabel:
          side === 'groom' ? 'أهل العريس' : side === 'bride' ? 'أهل العروس' : 'بدون تعيين',
        guestCount: g.rsvp?.guestCount ?? 0,
        language: g.language,
      }
    })
    .sort((a, b) => b.guestCount - a.guestCount || a.name.localeCompare(b.name, 'ar'))

  const bySide = (['groom', 'bride', 'none'] as const).map((side) => {
    const subset = attendingGuests.filter((g) => g.side === side)
    return {
      side,
      label: side === 'groom' ? 'أهل العريس' : side === 'bride' ? 'أهل العروس' : 'بدون تعيين',
      invitations: subset.length,
      peopleAttending: subset.reduce((sum, g) => sum + g.guestCount, 0),
    }
  })

  const byLanguage = (['EN', 'AR', 'HE'] as Language[]).map((lang) => {
    const subset = guests.filter((g) => g.language === lang)
    return {
      language: lang,
      invitations: subset.length,
      attendingInvitations: subset.filter((g) => g.rsvp?.status === 'ATTENDING').length,
      peopleAttending: subset
        .filter((g) => g.rsvp?.status === 'ATTENDING')
        .reduce((sum, g) => sum + (g.rsvp?.guestCount ?? 0), 0),
    }
  })

  const openRate = totalInvitationLinks === 0 ? 0 : openedInvitations / totalInvitationLinks
  const rsvpRate = totalInvitationLinks === 0 ? 0 : rsvpResponses / totalInvitationLinks

  return {
    totalInvitedPeople,
    totalInvitationLinks,
    openedInvitations,
    notOpened,
    rsvpResponses,
    attendingInvitations,
    notAttending,
    totalPeopleAttending,
    pendingResponse,
    openRate,
    rsvpRate,
    byLanguage,
    bySide,
    attendingGuests,
  }
}

export async function listGuests(query: GuestListQuery) {
  const event = await getCurrentEventCached()
  const page = Math.max(1, query.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25))
  const sortBy = query.sortBy ?? 'createdAt'
  const sortDir = query.sortDir ?? 'desc'

  const and: Prisma.GuestWhereInput[] = [{ eventId: event.id }]

  if (query.search) {
    const q = query.search.trim()
    and.push({
      OR: [
        { fullName: { contains: q, mode: 'insensitive' } },
        { phoneNumber: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    })
  }

  const filterValues = (query.filters?.length
    ? query.filters
    : query.filter
      ? [query.filter]
      : []) as GuestFilterValue[]

  const activeFilters = filterValues.filter((f) => f && f !== 'all')

  for (const filter of activeFilters) {
    if (filter === 'ar') and.push({ language: 'AR' })
    else if (filter === 'he') and.push({ language: 'HE' })
    else if (filter === 'en') and.push({ language: 'EN' })
    else if (filter === 'opened') {
      and.push({ OR: [{ openCount: { gt: 0 } }, { firstOpenedAt: { not: null } }] })
    } else if (filter === 'not_opened') {
      and.push({ openCount: 0, firstOpenedAt: null })
    } else if (filter === 'attending') and.push({ rsvp: { status: 'ATTENDING' } })
    else if (filter === 'not_attending') and.push({ rsvp: { status: 'NOT_ATTENDING' } })
    else if (filter === 'pending') {
      and.push({ OR: [{ rsvp: null }, { rsvp: { status: 'PENDING' } }] })
    } else if (filter === 'invite_sent') and.push({ inviteSent: true })
    else if (filter === 'invite_not_sent') and.push({ inviteSent: false })
    else if (filter === 'groom_family') and.push({ tags: { has: 'GROOM_FAMILY' } })
    else if (filter === 'bride_family') and.push({ tags: { has: 'BRIDE_FAMILY' } })
  }

  if (query.language) {
    and.push({ language: query.language })
  }

  const where: Prisma.GuestWhereInput = { AND: and }

  const [total, rows] = await Promise.all([
    prisma.guest.count({ where }),
    prisma.guest.findMany({
      where,
      include: { rsvp: true },
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return {
    total,
    page,
    pageSize,
    items: rows.map((g) => ({
      id: g.id,
      fullName: g.fullName,
      titleKey: g.titleKey,
      includeFamily: g.includeFamily,
      familySuffixKey: g.familySuffixKey,
      displayName: composeGuestDisplayName({
        fullName: g.fullName,
        language: g.language,
        titleKey: g.titleKey,
        includeFamily: g.includeFamily,
        familySuffixKey: g.familySuffixKey,
      }),
      phoneNumber: g.phoneNumber,
      email: g.email,
      language: g.language,
      inviteToken: g.inviteToken,
      inviteUrl: invitationPublicUrl(g.inviteToken, env.PUBLIC_APP_URL, g.language),
      isActive: g.isActive,
      inviteSent: g.inviteSent,
      inviteSentAt: g.inviteSentAt,
      maxGuestsAllowed: g.maxGuestsAllowed,
      invitationStatus: g.invitationStatus,
      displayStatus: deriveDisplayStatus(g),
      firstOpenedAt: g.firstOpenedAt,
      lastOpenedAt: g.lastOpenedAt,
      openCount: g.openCount,
      rsvpStatus: (g.rsvp?.status ?? 'PENDING') as RsvpStatus,
      attendingGuestCount: g.rsvp?.guestCount ?? 0,
      rsvpSubmittedAt: g.rsvp?.submittedAt ?? null,
      message: g.rsvp?.message ?? null,
      notes: g.notes,
      tags: g.tags,
      tableNumber: g.tableNumber,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    })),
  }
}

export async function createGuest(input: {
  fullName: string
  titleKey?: string | null
  includeFamily?: boolean
  familySuffixKey?: string | null
  phoneNumber?: string | null
  email?: string | null
  language: Language
  maxGuestsAllowed: number
  notes?: string | null
  tags?: Guest['tags']
  tableNumber?: string | null
}) {
  const event = await getCurrentEvent()
  if (input.maxGuestsAllowed < 1 || input.maxGuestsAllowed > 50) {
    throw new AppError(400, 'maxGuestsAllowed must be between 1 and 50')
  }

  const includeFamily = Boolean(input.includeFamily)
  return prisma.guest.create({
    data: {
      eventId: event.id,
      fullName: input.fullName.trim(),
      titleKey: input.titleKey ?? 'none',
      includeFamily,
      familySuffixKey: includeFamily ? (input.familySuffixKey ?? 'none') : null,
      phoneNumber: input.phoneNumber?.trim() || null,
      email: input.email?.trim() || null,
      language: input.language,
      maxGuestsAllowed: input.maxGuestsAllowed,
      notes: input.notes?.trim() || null,
      tags: input.tags ?? [],
      tableNumber: input.tableNumber?.trim() || null,
      inviteToken: generateInviteToken(),
      rsvp: { create: { status: 'PENDING', guestCount: 0 } },
    },
    include: { rsvp: true },
  })
}

export async function updateGuest(
  id: string,
  input: Partial<{
    fullName: string
    titleKey: string | null
    includeFamily: boolean
    familySuffixKey: string | null
    phoneNumber: string | null
    email: string | null
    language: Language
    maxGuestsAllowed: number
    notes: string | null
    tags: Guest['tags']
    tableNumber: string | null
    isActive: boolean
    inviteSent: boolean
  }>,
) {
  const existing = await prisma.guest.findUnique({ where: { id } })
  if (!existing) throw new AppError(404, 'Guest not found')

  if (input.maxGuestsAllowed != null && (input.maxGuestsAllowed < 1 || input.maxGuestsAllowed > 50)) {
    throw new AppError(400, 'maxGuestsAllowed must be between 1 and 50')
  }

  const includeFamily =
    input.includeFamily !== undefined ? input.includeFamily : existing.includeFamily
  const familySuffixKey =
    input.includeFamily === false
      ? null
      : input.familySuffixKey !== undefined
        ? input.familySuffixKey
        : existing.familySuffixKey

  const inviteSentData =
    input.inviteSent === undefined
      ? {}
      : input.inviteSent
        ? {
            inviteSent: true,
            inviteSentAt: existing.inviteSentAt ?? new Date(),
          }
        : { inviteSent: false, inviteSentAt: null }

  return prisma.guest.update({
    where: { id },
    data: {
      ...(input.fullName != null ? { fullName: input.fullName.trim() } : {}),
      ...(input.titleKey !== undefined ? { titleKey: input.titleKey } : {}),
      ...(input.includeFamily !== undefined ? { includeFamily: input.includeFamily } : {}),
      ...(input.includeFamily !== undefined || input.familySuffixKey !== undefined
        ? { familySuffixKey: includeFamily ? familySuffixKey : null }
        : {}),
      ...(input.phoneNumber !== undefined ? { phoneNumber: input.phoneNumber?.trim() || null } : {}),
      ...(input.email !== undefined ? { email: input.email?.trim() || null } : {}),
      ...(input.language != null ? { language: input.language } : {}),
      ...(input.maxGuestsAllowed != null ? { maxGuestsAllowed: input.maxGuestsAllowed } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      ...(input.tags != null ? { tags: input.tags } : {}),
      ...(input.tableNumber !== undefined ? { tableNumber: input.tableNumber?.trim() || null } : {}),
      ...(input.isActive != null ? { isActive: input.isActive } : {}),
      ...inviteSentData,
    },
    include: { rsvp: true },
  })
}

export async function deleteGuest(id: string) {
  await prisma.guest.delete({ where: { id } }).catch(() => {
    throw new AppError(404, 'Guest not found')
  })
}

export async function bulkDeleteGuests(ids: string[]) {
  const result = await prisma.guest.deleteMany({ where: { id: { in: ids } } })
  return { deleted: result.count }
}

export async function regenerateInviteLink(id: string) {
  const token = generateInviteToken()
  const guest = await prisma.guest.update({
    where: { id },
    data: { inviteToken: token },
  })
  return {
    inviteToken: guest.inviteToken,
    inviteUrl: invitationPublicUrl(guest.inviteToken, env.PUBLIC_APP_URL, guest.language),
  }
}

export async function exportGuestsCsv() {
  const { items } = await listGuests({ page: 1, pageSize: 10000, sortBy: 'fullName', sortDir: 'asc' })
  const header = [
    'fullName',
    'displayName',
    'titleKey',
    'includeFamily',
    'familySuffixKey',
    'phoneNumber',
    'email',
    'language',
    'inviteSent',
    'maxGuestsAllowed',
    'inviteUrl',
    'isActive',
    'displayStatus',
    'openCount',
    'rsvpStatus',
    'attendingGuestCount',
    'message',
    'notes',
    'tags',
    'tableNumber',
    'firstOpenedAt',
    'lastOpenedAt',
    'rsvpSubmittedAt',
  ]
  const lines = [header.join(',')]
  for (const g of items) {
    lines.push(
      [
        escapeCsvCell(g.fullName),
        escapeCsvCell(g.displayName),
        escapeCsvCell(g.titleKey),
        escapeCsvCell(g.includeFamily ? 'yes' : 'no'),
        escapeCsvCell(g.familySuffixKey),
        escapeCsvCell(g.phoneNumber),
        escapeCsvCell(g.email),
        escapeCsvCell(g.language),
        escapeCsvCell(g.inviteSent ? 'yes' : 'no'),
        escapeCsvCell(g.maxGuestsAllowed),
        escapeCsvCell(g.inviteUrl),
        escapeCsvCell(g.isActive ? 'yes' : 'no'),
        escapeCsvCell(g.displayStatus),
        escapeCsvCell(g.openCount),
        escapeCsvCell(g.rsvpStatus),
        escapeCsvCell(g.attendingGuestCount),
        escapeCsvCell(g.message),
        escapeCsvCell(g.notes),
        escapeCsvCell(g.tags.join('|')),
        escapeCsvCell(g.tableNumber),
        escapeCsvCell(g.firstOpenedAt?.toISOString() ?? ''),
        escapeCsvCell(g.lastOpenedAt?.toISOString() ?? ''),
        escapeCsvCell(g.rsvpSubmittedAt?.toISOString() ?? ''),
      ].join(','),
    )
  }
  return lines.join('\n')
}

export async function exportRsvpCsv() {
  const { items } = await listGuests({ page: 1, pageSize: 10000 })
  const responded = items.filter((g) => g.rsvpStatus !== 'PENDING')
  const header = [
    'fullName',
    'displayName',
    'language',
    'rsvpStatus',
    'attendingGuestCount',
    'maxGuestsAllowed',
    'message',
    'rsvpSubmittedAt',
  ]
  const lines = [header.join(',')]
  for (const g of responded) {
    lines.push(
      [
        escapeCsvCell(g.fullName),
        escapeCsvCell(g.displayName),
        escapeCsvCell(g.language),
        escapeCsvCell(g.rsvpStatus),
        escapeCsvCell(g.attendingGuestCount),
        escapeCsvCell(g.maxGuestsAllowed),
        escapeCsvCell(g.message),
        escapeCsvCell(g.rsvpSubmittedAt?.toISOString() ?? ''),
      ].join(','),
    )
  }
  return lines.join('\n')
}
