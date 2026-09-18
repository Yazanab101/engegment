import type { Event } from '@prisma/client'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** Format event wall-clock time as UTC ICS/Google datetime. */
function toIcsDate(date: Date, timeHHmm: string): string {
  const [h, m] = timeHHmm.split(':').map((x) => Number(x) || 0)
  const y = date.getUTCFullYear()
  const mo = date.getUTCMonth()
  const d = date.getUTCDate()
  const local = new Date(Date.UTC(y, mo, d, h, m, 0))
  return (
    `${local.getUTCFullYear()}${pad(local.getUTCMonth() + 1)}${pad(local.getUTCDate())}` +
    `T${pad(local.getUTCHours())}${pad(local.getUTCMinutes())}00Z`
  )
}

function toIcsEnd(date: Date, timeHHmm: string, durationHours = 3): string {
  const [h, m] = timeHHmm.split(':').map((x) => Number(x) || 0)
  const end = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), h + durationHours, m, 0),
  )
  return (
    `${end.getUTCFullYear()}${pad(end.getUTCMonth() + 1)}${pad(end.getUTCDate())}` +
    `T${pad(end.getUTCHours())}${pad(end.getUTCMinutes())}00Z`
  )
}

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\n|\r/g, '\\n')
}

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

function buildDescription(event: Event): string {
  const lines = [
    `${event.groomName} & ${event.brideName}`,
    event.venueName,
    event.venueAddress,
  ]
  if (event.additionalInfo?.trim()) lines.push(event.additionalInfo.trim())
  if (event.parkingInfo?.trim()) lines.push(`Parking: ${event.parkingInfo.trim()}`)
  return lines.filter(Boolean).join('\n')
}

export function buildIcs(event: Event, options?: { url?: string | null }): string {
  const start = toIcsDate(event.eventDate, event.eventStartTime)
  const end = toIcsEnd(event.eventDate, event.eventStartTime)
  const location = `${event.venueName}, ${event.venueAddress}`
  const description = buildDescription(event)
  const url = options?.url?.trim() || event.googleMapsUrl || null

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Engegment Invitation//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@engegment`,
    `DTSTAMP:${nowIcsStamp()}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `LOCATION:${escapeIcs(location)}`,
  ]

  if (url) {
    lines.push(`URL:${escapeIcs(url)}`)
  }

  lines.push('END:VEVENT', 'END:VCALENDAR')
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`
}

export function googleCalendarUrl(event: Event, options?: { url?: string | null }): string {
  const start = toIcsDate(event.eventDate, event.eventStartTime)
  const end = toIcsEnd(event.eventDate, event.eventStartTime)
  const details = buildDescription(event)
  const location = `${event.venueName}, ${event.venueAddress}`
  const eventUrl = options?.url?.trim() || event.googleMapsUrl || null

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${start}/${end}`,
    details: eventUrl ? `${details}\n\n${eventUrl}` : details,
    location,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
