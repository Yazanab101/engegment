import type { Event, Guest, Language, Rsvp, RsvpStatus } from '@prisma/client'
import { env } from '../config/env.js'

export type PublicGuest = {
  displayName: string
  language: Language
  maxGuestsAllowed: number
  rsvpStatus: RsvpStatus
  attendingGuestCount: number
  message: string | null
  tableNumber: string | null
}

export type PublicEvent = {
  title: string
  brideName: string
  groomName: string
  eventDate: string
  eventStartTime: string
  venueName: string
  venueAddress: string
  googleMapsUrl: string | null
  wazeUrl: string | null
  latitude: number | null
  longitude: number | null
  rsvpDeadline: string | null
  contactPhone: string | null
  whatsappPhone: string | null
  dressCode: string | null
  parkingInfo: string | null
  additionalInfo: string | null
  showTableAssignments: boolean
  intro: string | null
  footer: string | null
  tagline: string | null
  joinUsMessage: string | null
  celebrationNote: string | null
  ticketHeading: string | null
  imageCoupleColor: string | null
  imageCoupleBw: string | null
  rsvpClosed: boolean
}

function pickLocalized(
  language: Language,
  en: string | null | undefined,
  ar: string | null | undefined,
  he: string | null | undefined,
): string | null {
  if (language === 'AR') return ar ?? en ?? null
  if (language === 'HE') return he ?? en ?? null
  return en ?? null
}

export function toPublicGuest(guest: Guest & { rsvp: Rsvp | null }, event: Event): PublicGuest {
  return {
    displayName: guest.fullName,
    language: guest.language,
    maxGuestsAllowed: guest.maxGuestsAllowed,
    rsvpStatus: guest.rsvp?.status ?? 'PENDING',
    attendingGuestCount: guest.rsvp?.guestCount ?? 0,
    message: guest.rsvp?.message ?? null,
    tableNumber: event.showTableAssignments ? guest.tableNumber : null,
  }
}

export function toPublicEvent(event: Event, language: Language): PublicEvent {
  const deadline = event.rsvpDeadline
  const rsvpClosed = deadline ? deadline.getTime() < Date.now() : false

  return {
    title: event.title,
    brideName: event.brideName,
    groomName: event.groomName,
    eventDate: event.eventDate.toISOString(),
    eventStartTime: event.eventStartTime,
    venueName: event.venueName,
    venueAddress: event.venueAddress,
    googleMapsUrl: event.googleMapsUrl,
    wazeUrl: event.wazeUrl,
    latitude: event.latitude,
    longitude: event.longitude,
    rsvpDeadline: event.rsvpDeadline?.toISOString() ?? null,
    contactPhone: event.contactPhone,
    whatsappPhone: event.whatsappPhone,
    dressCode: event.dressCode,
    parkingInfo: event.parkingInfo,
    additionalInfo: event.additionalInfo,
    showTableAssignments: event.showTableAssignments,
    intro: pickLocalized(language, event.introEn, event.introAr, event.introHe),
    footer: pickLocalized(language, event.footerEn, event.footerAr, event.footerHe),
    tagline: pickLocalized(language, event.taglineEn, event.taglineAr, event.taglineHe),
    joinUsMessage: pickLocalized(
      language,
      event.joinUsMessageEn,
      event.joinUsMessageAr,
      event.joinUsMessageHe,
    ),
    celebrationNote: pickLocalized(
      language,
      event.celebrationNoteEn,
      event.celebrationNoteAr,
      event.celebrationNoteHe,
    ),
    ticketHeading: pickLocalized(
      language,
      event.ticketHeadingEn,
      event.ticketHeadingAr,
      event.ticketHeadingHe,
    ),
    imageCoupleColor: event.imageCoupleColor,
    imageCoupleBw: event.imageCoupleBw,
    rsvpClosed,
  }
}

export function formatDateShort(iso: string, language: Language): string {
  const d = new Date(iso)
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = d.getUTCFullYear()
  void language
  return `${dd}.${mm}.${yyyy}`
}

export { env }
