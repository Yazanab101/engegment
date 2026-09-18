import type { Event } from '@prisma/client'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

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

export function buildIcs(event: Event): string {
  const start = toIcsDate(event.eventDate, event.eventStartTime)
  const endDate = new Date(event.eventDate)
  const [h, m] = event.eventStartTime.split(':').map((x) => Number(x) || 0)
  endDate.setUTCHours(h + 3, m, 0, 0)
  const end = toIcsDate(endDate, `${pad(endDate.getUTCHours())}:${pad(endDate.getUTCMinutes())}`)

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Engegment Invitation//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@engegment`,
    `DTSTAMP:${toIcsDate(new Date(), '00:00')}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    `DESCRIPTION:${escapeIcs(`${event.groomName} & ${event.brideName}`)}`,
    `LOCATION:${escapeIcs(`${event.venueName}, ${event.venueAddress}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.join('\r\n')
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export function googleCalendarUrl(event: Event): string {
  const start = toIcsDate(event.eventDate, event.eventStartTime)
  const endDate = new Date(event.eventDate)
  const [h, m] = event.eventStartTime.split(':').map((x) => Number(x) || 0)
  endDate.setUTCHours(h + 3, m, 0, 0)
  const end = `${endDate.getUTCFullYear()}${pad(endDate.getUTCMonth() + 1)}${pad(endDate.getUTCDate())}T${pad(endDate.getUTCHours())}${pad(endDate.getUTCMinutes())}00Z`

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${start}/${end}`,
    details: `${event.groomName} & ${event.brideName}`,
    location: `${event.venueName}, ${event.venueAddress}`,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
