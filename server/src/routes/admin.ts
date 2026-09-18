import { Router } from 'express'
import { z } from 'zod'
import QRCode from 'qrcode'
import { asyncHandler } from '../lib/errors.js'
import { requireAdmin } from '../middleware/auth.js'
import {
  bulkDeleteGuests,
  createGuest,
  deleteGuest,
  exportGuestsCsv,
  exportRsvpCsv,
  getDashboardStats,
  listGuests,
  regenerateInviteLink,
  updateGuest,
} from '../services/guestService.js'
import { importGuestsFromCsv } from '../services/importService.js'
import { adminSetRsvp } from '../services/rsvpService.js'
import { prisma } from '../lib/prisma.js'
import { AppError } from '../lib/errors.js'
import { buildWhatsAppInviteMessage, whatsappShareUrl } from '../services/whatsappService.js'
import { invitationPublicUrl } from '../lib/tokens.js'
import { env } from '../config/env.js'
import { getCurrentEvent } from '../services/invitationService.js'

export const adminRouter = Router()
adminRouter.use(requireAdmin)

const guestTagSchema = z.enum([
  'FAMILY',
  'FRIENDS',
  'WORK',
  'BRIDE_FAMILY',
  'GROOM_FAMILY',
  'VIP',
])

const guestBodySchema = z.object({
  fullName: z.string().min(1).max(200),
  phoneNumber: z.string().max(40).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')).transform((v) => v || null),
  language: z.enum(['AR', 'HE', 'EN']),
  maxGuestsAllowed: z.number().int().min(1).max(50),
  notes: z.string().max(2000).optional().nullable(),
  tags: z.array(guestTagSchema).optional(),
  tableNumber: z.string().max(40).optional().nullable(),
  isActive: z.boolean().optional(),
})

adminRouter.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    res.json(await getDashboardStats())
  }),
)

adminRouter.get(
  '/guests',
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        page: z.coerce.number().optional(),
        pageSize: z.coerce.number().optional(),
        search: z.string().optional(),
        filter: z
          .enum([
            'all',
            'opened',
            'not_opened',
            'attending',
            'not_attending',
            'pending',
            'ar',
            'he',
            'en',
          ])
          .optional(),
        language: z.enum(['AR', 'HE', 'EN']).optional(),
        sortBy: z.enum(['fullName', 'createdAt', 'lastOpenedAt', 'openCount']).optional(),
        sortDir: z.enum(['asc', 'desc']).optional(),
      })
      .parse(req.query)
    res.json(await listGuests(query))
  }),
)

adminRouter.post(
  '/guests',
  asyncHandler(async (req, res) => {
    const body = guestBodySchema.parse(req.body)
    const guest = await createGuest(body)
    res.status(201).json(guest)
  }),
)

adminRouter.post(
  '/guests/bulk-delete',
  asyncHandler(async (req, res) => {
    const body = z.object({ ids: z.array(z.string().min(1)).min(1) }).parse(req.body)
    res.json(await bulkDeleteGuests(body.ids))
  }),
)

adminRouter.post(
  '/guests/import',
  asyncHandler(async (req, res) => {
    const body = z.object({ csv: z.string().min(1) }).parse(req.body)
    const result = await importGuestsFromCsv(body.csv)
    res.status(result.failureCount ? 400 : 200).json(result)
  }),
)

adminRouter.get(
  '/guests/export',
  asyncHandler(async (_req, res) => {
    const csv = await exportGuestsCsv()
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="guests.csv"')
    res.send(csv)
  }),
)

adminRouter.get(
  '/guests/export-rsvp',
  asyncHandler(async (_req, res) => {
    const csv = await exportRsvpCsv()
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="rsvp.csv"')
    res.send(csv)
  }),
)

adminRouter.get(
  '/guests/:id',
  asyncHandler(async (req, res) => {
    const guest = await prisma.guest.findUnique({
      where: { id: String(req.params.id) },
      include: { rsvp: true, events: { orderBy: { createdAt: 'desc' }, take: 50 } },
    })
    if (!guest) throw new AppError(404, 'Guest not found')
    res.json({
      ...guest,
      inviteUrl: invitationPublicUrl(guest.inviteToken, env.PUBLIC_APP_URL),
    })
  }),
)

adminRouter.patch(
  '/guests/:id',
  asyncHandler(async (req, res) => {
    const body = guestBodySchema.partial().parse(req.body)
    const guest = await updateGuest(String(req.params.id), body)
    res.json(guest)
  }),
)

adminRouter.delete(
  '/guests/:id',
  asyncHandler(async (req, res) => {
    await deleteGuest(String(req.params.id))
    res.json({ ok: true })
  }),
)

adminRouter.post(
  '/guests/:id/regenerate-link',
  asyncHandler(async (req, res) => {
    res.json(await regenerateInviteLink(String(req.params.id)))
  }),
)

adminRouter.post(
  '/guests/:id/rsvp',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        status: z.enum(['PENDING', 'ATTENDING', 'NOT_ATTENDING']),
        guestCount: z.number().int().min(0).max(50).optional(),
        message: z.string().max(500).optional().nullable(),
      })
      .parse(req.body)
    await adminSetRsvp(String(req.params.id), body)
    res.json({ ok: true })
  }),
)

adminRouter.get(
  '/guests/:id/whatsapp',
  asyncHandler(async (req, res) => {
    const guest = await prisma.guest.findUnique({ where: { id: String(req.params.id) } })
    if (!guest) throw new AppError(404, 'Guest not found')
    const inviteUrl = invitationPublicUrl(guest.inviteToken, env.PUBLIC_APP_URL)
    const message = buildWhatsAppInviteMessage({
      language: guest.language,
      fullName: guest.fullName,
      inviteUrl,
    })
    res.json({
      message,
      url: whatsappShareUrl(guest.phoneNumber, message),
      inviteUrl,
    })
  }),
)

adminRouter.get(
  '/guests/:id/qr.png',
  asyncHandler(async (req, res) => {
    const guest = await prisma.guest.findUnique({ where: { id: String(req.params.id) } })
    if (!guest) throw new AppError(404, 'Guest not found')
    const url = invitationPublicUrl(guest.inviteToken, env.PUBLIC_APP_URL)
    const png = await QRCode.toBuffer(url, { type: 'png', width: 512, margin: 2 })
    res.setHeader('Content-Type', 'image/png')
    res.send(png)
  }),
)

adminRouter.get(
  '/events/current',
  asyncHandler(async (_req, res) => {
    res.json(await getCurrentEvent())
  }),
)

adminRouter.patch(
  '/events/current',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        title: z.string().min(1).optional(),
        brideName: z.string().min(1).optional(),
        groomName: z.string().min(1).optional(),
        eventDate: z.string().datetime().optional(),
        eventStartTime: z.string().min(1).optional(),
        venueName: z.string().min(1).optional(),
        venueAddress: z.string().min(1).optional(),
        googleMapsUrl: z.string().url().optional().nullable().or(z.literal('')),
        wazeUrl: z.string().url().optional().nullable().or(z.literal('')),
        latitude: z.number().optional().nullable(),
        longitude: z.number().optional().nullable(),
        rsvpDeadline: z.string().datetime().optional().nullable(),
        contactPhone: z.string().optional().nullable(),
        whatsappPhone: z.string().optional().nullable(),
        dressCode: z.string().optional().nullable(),
        parkingInfo: z.string().optional().nullable(),
        additionalInfo: z.string().optional().nullable(),
        showTableAssignments: z.boolean().optional(),
        introEn: z.string().optional().nullable(),
        introAr: z.string().optional().nullable(),
        introHe: z.string().optional().nullable(),
        footerEn: z.string().optional().nullable(),
        footerAr: z.string().optional().nullable(),
        footerHe: z.string().optional().nullable(),
        taglineEn: z.string().optional().nullable(),
        taglineAr: z.string().optional().nullable(),
        taglineHe: z.string().optional().nullable(),
        joinUsMessageEn: z.string().optional().nullable(),
        joinUsMessageAr: z.string().optional().nullable(),
        joinUsMessageHe: z.string().optional().nullable(),
        celebrationNoteEn: z.string().optional().nullable(),
        celebrationNoteAr: z.string().optional().nullable(),
        celebrationNoteHe: z.string().optional().nullable(),
        ticketHeadingEn: z.string().optional().nullable(),
        ticketHeadingAr: z.string().optional().nullable(),
        ticketHeadingHe: z.string().optional().nullable(),
        imageCoupleColor: z.string().optional().nullable(),
        imageCoupleBw: z.string().optional().nullable(),
      })
      .parse(req.body)

    const data = {
      ...body,
      eventDate: body.eventDate ? new Date(body.eventDate) : undefined,
      rsvpDeadline:
        body.rsvpDeadline === null
          ? null
          : body.rsvpDeadline
            ? new Date(body.rsvpDeadline)
            : undefined,
      googleMapsUrl: body.googleMapsUrl === '' ? null : body.googleMapsUrl,
      wazeUrl: body.wazeUrl === '' ? null : body.wazeUrl,
    }

    const event = await prisma.event.update({
      where: { slug: 'current' },
      data,
    })
    res.json(event)
  }),
)
