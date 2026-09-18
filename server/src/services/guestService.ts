import type { Guest, Language, Prisma, Rsvp, RsvpStatus } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { AppError } from '../lib/errors.js'
import { generateInviteToken, invitationPublicUrl } from '../lib/tokens.js'
import { env } from '../config/env.js'
import { getCurrentEvent } from './invitationService.js'
import { escapeCsvCell } from '../lib/sanitize.js'

export type GuestListQuery = {
  page?: number
  pageSize?: number
  search?: string
  language?: Language
  filter?:
    | 'all'
    | 'opened'
    | 'not_opened'
    | 'attending'
    | 'not_attending'
    | 'pending'
    | 'ar'
    | 'he'
    | 'en'
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
  const event = await getCurrentEvent()
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
  }
}

export async function listGuests(query: GuestListQuery) {
  const event = await getCurrentEvent()
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

  const filter = query.filter ?? 'all'
  if (filter === 'ar' || query.language === 'AR') and.push({ language: 'AR' })
  if (filter === 'he' || query.language === 'HE') and.push({ language: 'HE' })
  if (filter === 'en' || query.language === 'EN') and.push({ language: 'EN' })
  if (filter === 'opened') {
    and.push({ OR: [{ openCount: { gt: 0 } }, { firstOpenedAt: { not: null } }] })
  }
  if (filter === 'not_opened') {
    and.push({ openCount: 0, firstOpenedAt: null })
  }
  if (filter === 'attending') and.push({ rsvp: { status: 'ATTENDING' } })
  if (filter === 'not_attending') and.push({ rsvp: { status: 'NOT_ATTENDING' } })
  if (filter === 'pending') {
    and.push({ OR: [{ rsvp: null }, { rsvp: { status: 'PENDING' } }] })
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
      phoneNumber: g.phoneNumber,
      email: g.email,
      language: g.language,
      inviteToken: g.inviteToken,
      inviteUrl: invitationPublicUrl(g.inviteToken, env.PUBLIC_APP_URL),
      isActive: g.isActive,
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

  return prisma.guest.create({
    data: {
      eventId: event.id,
      fullName: input.fullName.trim(),
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
    phoneNumber: string | null
    email: string | null
    language: Language
    maxGuestsAllowed: number
    notes: string | null
    tags: Guest['tags']
    tableNumber: string | null
    isActive: boolean
  }>,
) {
  const existing = await prisma.guest.findUnique({ where: { id } })
  if (!existing) throw new AppError(404, 'Guest not found')

  if (input.maxGuestsAllowed != null && (input.maxGuestsAllowed < 1 || input.maxGuestsAllowed > 50)) {
    throw new AppError(400, 'maxGuestsAllowed must be between 1 and 50')
  }

  return prisma.guest.update({
    where: { id },
    data: {
      ...(input.fullName != null ? { fullName: input.fullName.trim() } : {}),
      ...(input.phoneNumber !== undefined ? { phoneNumber: input.phoneNumber?.trim() || null } : {}),
      ...(input.email !== undefined ? { email: input.email?.trim() || null } : {}),
      ...(input.language != null ? { language: input.language } : {}),
      ...(input.maxGuestsAllowed != null ? { maxGuestsAllowed: input.maxGuestsAllowed } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      ...(input.tags != null ? { tags: input.tags } : {}),
      ...(input.tableNumber !== undefined ? { tableNumber: input.tableNumber?.trim() || null } : {}),
      ...(input.isActive != null ? { isActive: input.isActive } : {}),
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
    inviteUrl: invitationPublicUrl(guest.inviteToken, env.PUBLIC_APP_URL),
  }
}

export async function exportGuestsCsv() {
  const { items } = await listGuests({ page: 1, pageSize: 10000, sortBy: 'fullName', sortDir: 'asc' })
  const header = [
    'fullName',
    'phoneNumber',
    'email',
    'language',
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
        escapeCsvCell(g.phoneNumber),
        escapeCsvCell(g.email),
        escapeCsvCell(g.language),
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
