const recent = new Map<string, number>()

function clean(input: string, max: number) {
  return input.replace(/[<>]/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max)
}

function validPhone(raw: string) {
  const digits = String(raw || '').replace(/\D/g, '')
  return digits.length >= 8 && digits.length <= 15
}

export default async function handler(req: { method?: string; body?: unknown; headers?: Record<string, string | string[] | undefined> }, res: {
  status: (code: number) => { json: (body: unknown) => void; end: () => void }
  setHeader: (key: string, value: string) => void
}) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
    return
  }

  const body = (req.body || {}) as Record<string, unknown>
  if (typeof body.company === 'string' && body.company.trim()) {
    res.status(200).json({ ok: true })
    return
  }

  const name = clean(String(body.name || ''), 80)
  const phone = clean(String(body.phone || ''), 24)
  if (!name) {
    res.status(400).json({ error: 'INVALID_NAME' })
    return
  }
  if (!validPhone(phone)) {
    res.status(400).json({ error: 'INVALID_PHONE' })
    return
  }

  const ip = String(req.headers?.['x-forwarded-for'] || '').split(',')[0]?.trim() || 'unknown'
  const now = Date.now()
  const last = recent.get(ip) || 0
  if (now - last < 20_000) {
    res.status(429).json({ error: 'RATE_LIMITED' })
    return
  }
  recent.set(ip, now)

  const lead = {
    submissionId: clean(String(body.submissionId || crypto.randomUUID()), 80),
    name,
    phone,
    notes: clean(String(body.notes || ''), 2000) || null,
    preferredLanguage: ['ar', 'he', 'en'].includes(String(body.preferredLanguage)) ? body.preferredLanguage : 'ar',
    source: clean(String(body.source || 'moments_guest'), 80),
    landingPath: '/moments',
    createdAt: new Date().toISOString(),
  }

  console.info('[guest-lead]', JSON.stringify(lead))
  res.status(200).json({ ok: true })
}
