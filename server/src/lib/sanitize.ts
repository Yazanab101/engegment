import sanitizeHtml from 'sanitize-html'

export function sanitizeMessage(input: string): string {
  const cleaned = sanitizeHtml(input, {
    allowedTags: [],
    allowedAttributes: {},
  })
  return cleaned.trim().slice(0, 500)
}

export function escapeCsvCell(value: string | number | null | undefined): string {
  const raw = value == null ? '' : String(value)
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`
  }
  return raw
}
