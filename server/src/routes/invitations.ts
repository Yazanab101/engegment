import { Router } from 'express'
import { z } from 'zod'
import QRCode from 'qrcode'
import { asyncHandler } from '../lib/errors.js'
import {
  logGuestEvent,
  recordInvitationOpen,
  requireActiveGuestByToken,
} from '../services/invitationService.js'
import { toPublicEvent, toPublicGuest } from '../services/mappers.js'
import { rsvpBodySchema, submitRsvp } from '../services/rsvpService.js'
import { buildIcs, googleCalendarUrl } from '../services/calendarService.js'
import { invitationPublicUrl } from '../lib/tokens.js'
import { env } from '../config/env.js'

export const invitationsRouter = Router()

invitationsRouter.get(
  '/:token',
  asyncHandler(async (req, res) => {
    const guest = await requireActiveGuestByToken(String(req.params.token))
    const inviteUrl = invitationPublicUrl(guest.inviteToken, env.PUBLIC_APP_URL)
    res.json({
      guest: toPublicGuest(guest, guest.event),
      event: toPublicEvent(guest.event, guest.language),
      calendar: {
        googleUrl: googleCalendarUrl(guest.event, { url: inviteUrl }),
        icsUrl: `/api/invitations/${guest.inviteToken}/calendar.ics`,
      },
    })
  }),
)

invitationsRouter.post(
  '/:token/open',
  asyncHandler(async (req, res) => {
    const guest = await requireActiveGuestByToken(String(req.params.token))
    const result = await recordInvitationOpen(guest.id)
    res.json(result)
  }),
)

invitationsRouter.get(
  '/:token/rsvp',
  asyncHandler(async (req, res) => {
    const guest = await requireActiveGuestByToken(String(req.params.token))
    res.json({
      status: guest.rsvp?.status ?? 'PENDING',
      guestCount: guest.rsvp?.guestCount ?? 0,
      message: guest.rsvp?.message ?? null,
      maxGuestsAllowed: guest.maxGuestsAllowed,
      rsvpClosed: guest.event.rsvpDeadline
        ? guest.event.rsvpDeadline.getTime() < Date.now()
        : false,
    })
  }),
)

invitationsRouter.post(
  '/:token/rsvp',
  asyncHandler(async (req, res) => {
    const body = rsvpBodySchema.parse(req.body)
    const rsvp = await submitRsvp(String(req.params.token), body)
    res.json({
      status: rsvp.status,
      guestCount: rsvp.guestCount,
      message: rsvp.message,
      submittedAt: rsvp.submittedAt,
    })
  }),
)

invitationsRouter.get(
  '/:token/calendar.ics',
  asyncHandler(async (req, res) => {
    const guest = await requireActiveGuestByToken(String(req.params.token))
    const inviteUrl = invitationPublicUrl(guest.inviteToken, env.PUBLIC_APP_URL)
    const ics = buildIcs(guest.event, { url: inviteUrl })
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="invitation.ics"')
    res.send(ics)
  }),
)

invitationsRouter.post(
  '/:token/events',
  asyncHandler(async (req, res) => {
    const guest = await requireActiveGuestByToken(String(req.params.token))
    const body = z
      .object({
        type: z.enum(['LOCATION_CLICKED', 'CALENDAR_CLICKED']),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(req.body)
    await logGuestEvent(
      guest.id,
      body.type,
      body.metadata ? (JSON.parse(JSON.stringify(body.metadata)) as object) : undefined,
    )
    res.json({ ok: true })
  }),
)

invitationsRouter.get(
  '/:token/qr.png',
  asyncHandler(async (req, res) => {
    const guest = await requireActiveGuestByToken(String(req.params.token))
    const url = invitationPublicUrl(guest.inviteToken, env.PUBLIC_APP_URL)
    const png = await QRCode.toBuffer(url, { type: 'png', width: 512, margin: 2 })
    res.setHeader('Content-Type', 'image/png')
    res.send(png)
  }),
)
