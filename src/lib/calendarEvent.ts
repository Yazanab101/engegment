import type { PublicEvent } from '../api/client'

export type CalendarEventFields = {
  title: string
  description: string
  venueName: string
  venueAddress: string
  location: string
  eventDate: string
  eventStartTime: string
  url?: string | null
  uid?: string
}

const DEFAULT_DURATION_HOURS = 3

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** Format event wall-clock time as UTC ICS datetime (matches server calendarService). */
export function toIcsUtcDate(dateIso: string, timeHHmm: string): string {
  const date = new Date(dateIso)
  const [h, m] = timeHHmm.split(':').map((x) => Number(x) || 0)
  const y = date.getUTCFullYear()
  const mo = date.getUTCMonth()
  const d = date.getUTCDate()
  return `${y}${pad(mo + 1)}${pad(d)}T${pad(h)}${pad(m)}00Z`
}

export function toIcsEndUtc(
  dateIso: string,
  timeHHmm: string,
  durationHours = DEFAULT_DURATION_HOURS,
): string {
  const date = new Date(dateIso)
  const [h, m] = timeHHmm.split(':').map((x) => Number(x) || 0)
  const end = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), h + durationHours, m, 0),
  )
  return (
    `${end.getUTCFullYear()}${pad(end.getUTCMonth() + 1)}${pad(end.getUTCDate())}` +
    `T${pad(end.getUTCHours())}${pad(end.getUTCMinutes())}00Z`
  )
}

export function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\n|\r/g, '\\n')
}

/** RFC 5545 line folding at 75 octets (approx. via UTF-16 length for BMP text). */
function foldIcsLine(line: string): string {
  const limit = 75
  if (line.length <= limit) return line
  const parts: string[] = []
  let remaining = line
  parts.push(remaining.slice(0, limit))
  remaining = remaining.slice(limit)
  while (remaining.length > 0) {
    parts.push(` ${remaining.slice(0, limit - 1)}`)
    remaining = remaining.slice(limit - 1)
  }
  return parts.join('\r\n')
}

function nowIcsStamp(): string {
  const now = new Date()
  return (
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
  )
}

export function buildDescriptionFromEvent(event: PublicEvent): string {
  const lines = [`${event.groomName} & ${event.brideName}`, event.venueName, event.venueAddress]
  if (event.additionalInfo?.trim()) lines.push(event.additionalInfo.trim())
  if (event.parkingInfo?.trim()) lines.push(`Parking: ${event.parkingInfo.trim()}`)
  if (event.celebrationNote?.trim()) lines.push(event.celebrationNote.trim())
  return lines.filter(Boolean).join('\n')
}

export function fieldsFromEvent(
  event: PublicEvent,
  options?: { url?: string | null; uid?: string },
): CalendarEventFields {
  return {
    title: event.title,
    description: buildDescriptionFromEvent(event),
    venueName: event.venueName,
    venueAddress: event.venueAddress,
    location: `${event.venueName}, ${event.venueAddress}`,
    eventDate: event.eventDate,
    eventStartTime: event.eventStartTime,
    url: options?.url ?? event.googleMapsUrl,
    uid: options?.uid,
  }
}

export function buildIcs(fields: CalendarEventFields): string {
  const start = toIcsUtcDate(fields.eventDate, fields.eventStartTime)
  const end = toIcsEndUtc(fields.eventDate, fields.eventStartTime)
  const uid =
    fields.uid ??
    `${toIcsUtcDate(fields.eventDate, fields.eventStartTime)}-${encodeURIComponent(fields.title).slice(0, 48)}@engegment`

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Engegment Invitation//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${nowIcsStamp()}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcs(fields.title)}`,
    `DESCRIPTION:${escapeIcs(fields.description)}`,
    `LOCATION:${escapeIcs(fields.location)}`,
  ]

  if (fields.url?.trim()) {
    lines.push(`URL:${escapeIcs(fields.url.trim())}`)
  }

  lines.push('END:VEVENT', 'END:VCALENDAR')

  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`
}

/** Trigger .ics download / iOS Calendar import from generated content. */
export function downloadIcsFile(
  icsContent: string,
  filename = 'invitation.ics',
  options?: { preferNavigate?: boolean },
): void {
  const blob = new Blob([icsContent], {
    type: 'text/calendar;charset=utf-8',
  })
  const objectUrl = URL.createObjectURL(blob)

  // iOS Safari imports Calendar most reliably by navigating to the .ics resource.
  if (options?.preferNavigate) {
    window.location.assign(objectUrl)
    return
  }

  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2_000)
}


/** Open Google Calendar create-event URL; returns false if the popup was blocked. */
export function openGoogleCalendar(url: string): boolean {
  const opened = window.open(url, '_blank', 'noopener,noreferrer')
  if (opened) return true
  try {
    window.location.assign(url)
    return true
  } catch {
    return false
  }
}
