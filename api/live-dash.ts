import { createHmac, timingSafeEqual } from 'crypto'

const USER = (process.env.LIVE_DASH_USER || 'yazan').toLowerCase()
const PASS = process.env.LIVE_DASH_PASS || ''
const SECRET = process.env.LIVE_DASH_SECRET || ''
const COOKIE = 'live_dash'
const VPS = 'http://141.136.44.242:4010'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

type VercelRes = {
  status: (code: number) => { json: (body: unknown) => void; end: () => void }
  setHeader: (key: string, value: string | string[]) => void
}

type VercelReq = {
  method?: string
  body?: unknown
  query?: Record<string, string | string[] | undefined>
  headers?: Record<string, string | string[] | undefined>
}

let vpsCookie: { value: string; exp: number } | null = null

function header(req: VercelReq, name: string) {
  const raw = req.headers?.[name] ?? req.headers?.[name.toLowerCase()]
  return Array.isArray(raw) ? raw[0] : raw || ''
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

function sign(payload: string) {
  return createHmac('sha256', SECRET).update(payload).digest('hex')
}

function makeToken() {
  const payload = `${USER}.${Date.now() + MAX_AGE_MS}`
  return `${payload}.${sign(payload)}`
}

function validToken(token: string) {
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [user, expRaw, mac] = parts
  const payload = `${user}.${expRaw}`
  if (!safeEqual(mac, sign(payload))) return false
  if (user !== USER) return false
  const exp = Number(expRaw)
  return Number.isFinite(exp) && exp > Date.now()
}

function readCookie(req: VercelReq) {
  const raw = header(req, 'cookie')
  const match = raw.match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : ''
}

function setSessionCookie(res: VercelRes, token: string | null) {
  const base = `${COOKIE}=${token ? encodeURIComponent(token) : ''}; Path=/; HttpOnly; SameSite=Lax; Secure`
  res.setHeader('Set-Cookie', token ? `${base}; Max-Age=${Math.floor(MAX_AGE_MS / 1000)}` : `${base}; Max-Age=0`)
}

function q(query: VercelReq['query'], key: string, fallback = '') {
  const value = query?.[key]
  return Array.isArray(value) ? value[0] || fallback : value || fallback
}

async function vpsLogin() {
  if (vpsCookie && vpsCookie.exp > Date.now() + 10_000) return vpsCookie.value
  const res = await fetch(`${VPS}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: USER, password: PASS }),
  })
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) {
    throw new Error(body.error || 'VPS_LOGIN_FAILED')
  }
  const cookies =
    typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : [res.headers.get('set-cookie')].filter(Boolean)
  const value = cookies.map((item) => String(item).split(';')[0]).join('; ')
  if (!value) throw new Error('VPS_SESSION_MISSING')
  vpsCookie = { value, exp: Date.now() + 6 * 60 * 60 * 1000 }
  return value
}

async function vpsError(res: Response, fallback: string) {
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  throw new Error(body.error || fallback)
}

async function vpsGet<T>(path: string, cookie: string): Promise<T> {
  const res = await fetch(`${VPS}${path}`, {
    headers: { cookie, accept: 'application/json' },
  })
  if (res.status === 401) {
    vpsCookie = null
    const retryCookie = await vpsLogin()
    const retry = await fetch(`${VPS}${path}`, {
      headers: { cookie: retryCookie, accept: 'application/json' },
    })
    if (!retry.ok) await vpsError(retry, `VPS_${retry.status}`)
    return (await retry.json()) as T
  }
  if (!res.ok) await vpsError(res, `VPS_${res.status}`)
  return (await res.json()) as T
}

function digitsOnly(value: string) {
  return String(value || '').replace(/\D/g, '')
}

function namesClose(a: string, b: string) {
  const left = a.trim().toLowerCase()
  const right = b.trim().toLowerCase()
  if (!left || !right) return false
  return left === right || left.includes(right) || right.includes(left)
}

async function searchGuests(cookie: string, raw: string) {
  const query = raw.trim()
  if (!query) return []
  const last4 = digitsOnly(query).slice(-4)
  const memoryGuests = await vpsGet<{ id: string; name: string; phoneLast4?: string | null }[]>(
    `/api/admin/memories/guests?search=${encodeURIComponent(query)}&sort=name`,
    cookie,
  ).catch(() => [])
  const matched = new Set((Array.isArray(memoryGuests) ? memoryGuests : []).map((guest) => guest.id))

  let invitedNames: string[] = []
  if (last4.length === 4) {
    const invited = await vpsGet<{
      items: { fullName?: string; displayName?: string; phoneNumber?: string | null }[]
    }>(`/api/admin/guests?search=${encodeURIComponent(last4)}&pageSize=80`, cookie).catch(() => ({
      items: [],
    }))
    invitedNames = (invited.items || [])
      .filter((guest) => digitsOnly(guest.phoneNumber || '').endsWith(last4))
      .map((guest) => String(guest.displayName || guest.fullName || ''))
  }

  if (last4.length === 4 || invitedNames.length) {
    const everyone = await vpsGet<{ id: string; name: string; phoneLast4?: string | null }[]>(
      '/api/admin/memories/guests?sort=activity',
      cookie,
    ).catch(() => [])
    for (const guest of Array.isArray(everyone) ? everyone : []) {
      const phone = digitsOnly(guest.phoneLast4 || '')
      if (last4.length === 4 && (phone === last4 || phone.endsWith(last4))) matched.add(guest.id)
      if (invitedNames.some((name) => namesClose(name, guest.name))) matched.add(guest.id)
    }
  }
  return [...matched]
}

async function vpsPost<T>(path: string, cookie: string, body: object): Promise<T> {
  const res = await fetch(`${VPS}${path}`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) await vpsError(res, `VPS_${res.status}`)
  return (await res.json()) as T
}

export default async function handler(req: VercelReq, res: VercelRes) {
  res.setHeader('Cache-Control', 'no-store')
  if (!PASS || !SECRET) {
    res.status(503).json({ error: 'LIVE_DASH_NOT_CONFIGURED' })
    return
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method === 'POST') {
    const raw = req.body
    let body: Record<string, unknown> = {}
    try {
      body = (typeof raw === 'string' ? JSON.parse(raw || '{}') : raw || {}) as Record<string, unknown>
    } catch {
      body = {}
    }
    if (body.action === 'logout') {
      setSessionCookie(res, null)
      res.status(200).json({ ok: true })
      return
    }
    const username = String(body.username || body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    if (!safeEqual(username, USER) || !safeEqual(password, PASS)) {
      res.status(401).json({ error: 'بيانات الدخول غلط' })
      return
    }
    setSessionCookie(res, makeToken())
    res.status(200).json({ ok: true, user: USER })
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
    return
  }

  if (!validToken(readCookie(req))) {
    res.status(401).json({ error: 'UNAUTHORIZED' })
    return
  }

  try {
    if (q(req.query, 'ping') === '1') {
      res.status(200).json({ ok: true })
      return
    }

    const cookie = await vpsLogin()
    const signedId = q(req.query, 'signed')
    if (signedId) {
      const signed = await vpsPost<{ url: string }>(
        `/api/admin/memories/media/${encodeURIComponent(signedId)}/signed-url`,
        cookie,
        {},
      )
      res.status(200).json(signed)
      return
    }

    const tab = q(req.query, 'tab', 'all')
    const page = q(req.query, 'page', '1')
    const search = q(req.query, 'search').trim()
    const view = q(req.query, 'view', 'guests')
    const guestId = q(req.query, 'guestId')
    const filter = tab === 'photos' || tab === 'videos' ? tab : 'all'
    const pageNum = Math.max(1, Number(page) || 1)
    const emptyMedia = { items: [], page: 1, pageSize: 24, total: 0, hasMore: false }

    type LiveGuest = {
      id: string
      name: string
      table?: string | null
      phoneLast4?: string | null
      photos: number
      videos: number
      messages: number
      firstUpload?: string | null
      lastUpload?: string | null
      lastSeenAt?: string
      createdAt?: string
      latestThumb?: { type?: string; thumbUrl?: string | null; url?: string | null } | null
    }

    function pageGuests(rows: LiveGuest[]) {
      const pageSize = 24
      const start = (pageNum - 1) * pageSize
      const items = rows.slice(start, start + pageSize)
      return { items, page: pageNum, pageSize, total: rows.length, hasMore: start + items.length < rows.length }
    }

    async function loadGuestCards() {
      const query = search ? `&search=${encodeURIComponent(search)}` : ''
      const rows = await vpsGet<LiveGuest[]>(
        `/api/admin/memories/guests?sort=activity${query}`,
        cookie,
      ).catch(() => [] as LiveGuest[])
      const list = Array.isArray(rows) ? rows : []
      if (!search) return list
      const found = await searchGuests(cookie, search)
      if (!found.length) return list
      const extra = found.filter((id) => !list.some((guest) => guest.id === id))
      if (!extra.length) return list
      const everyone = await vpsGet<LiveGuest[]>('/api/admin/memories/guests?sort=activity', cookie).catch(
        () => [] as LiveGuest[],
      )
      const missing = (Array.isArray(everyone) ? everyone : []).filter((guest) => extra.includes(guest.id))
      return [...list, ...missing]
    }

    if (guestId) {
      let guest: LiveGuest | null = null
      try {
        guest = await vpsGet<LiveGuest>(`/api/admin/memories/guests/${encodeURIComponent(guestId)}`, cookie)
      } catch {
        res.status(404).json({ error: 'NOT_FOUND' })
        return
      }
      const [overview, media, messages] = await Promise.all([
        vpsGet('/api/admin/memories/overview', cookie),
        tab === 'messages'
          ? Promise.resolve(emptyMedia)
          : vpsGet(
              `/api/admin/memories/media?filter=${encodeURIComponent(filter)}&guestId=${encodeURIComponent(guestId)}&page=${encodeURIComponent(page)}&limit=24`,
              cookie,
            ),
        vpsGet(
          `/api/admin/memories/messages?archived=false&guestId=${encodeURIComponent(guestId)}`,
          cookie,
        ).catch(() => []),
      ])
      res.status(200).json({ overview, guest, guests: pageGuests([]), media, messages })
      return
    }

    if (view !== 'media') {
      const [overview, cards] = await Promise.all([vpsGet('/api/admin/memories/overview', cookie), loadGuestCards()])
      res.status(200).json({
        overview,
        guest: null,
        guests: pageGuests(cards),
        media: emptyMedia,
        messages: [],
      })
      return
    }

    if (search) {
      const found = await searchGuests(cookie, search)
      const ids = found.slice(0, 12)
      if (!ids.length) {
        const overview = await vpsGet('/api/admin/memories/overview', cookie)
        res.status(200).json({
          overview,
          guest: null,
          guests: pageGuests([]),
          media: emptyMedia,
          messages: [],
        })
        return
      }
      const [overview, mediaPages, messagePages] = await Promise.all([
        vpsGet('/api/admin/memories/overview', cookie),
        tab === 'messages'
          ? Promise.resolve([])
          : Promise.all(
              ids.map((id) =>
                vpsGet<{ items: { createdAt: string }[] }>(
                  `/api/admin/memories/media?filter=${encodeURIComponent(filter)}&guestId=${encodeURIComponent(id)}&limit=80`,
                  cookie,
                ),
              ),
            ),
        Promise.all(
          ids.map((id) =>
            vpsGet<{ createdAt: string }[]>(
              `/api/admin/memories/messages?archived=false&guestId=${encodeURIComponent(id)}`,
              cookie,
            ),
          ),
        ),
      ])
      const items = mediaPages
        .flatMap((pageData) => pageData.items || [])
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      const messages = messagePages
        .flat()
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      res.status(200).json({
        overview,
        guest: null,
        guests: pageGuests([]),
        media: { items, page: 1, pageSize: items.length, total: items.length, hasMore: false },
        messages,
      })
      return
    }

    const [overview, media, messages] = await Promise.all([
      vpsGet('/api/admin/memories/overview', cookie),
      tab === 'messages'
        ? Promise.resolve(emptyMedia)
        : vpsGet(
            `/api/admin/memories/media?filter=${encodeURIComponent(filter)}&page=${encodeURIComponent(page)}&limit=24`,
            cookie,
          ),
      tab === 'messages'
        ? vpsGet('/api/admin/memories/messages?archived=false', cookie)
        : Promise.resolve([]),
    ])
    res.status(200).json({ overview, guest: null, guests: pageGuests([]), media, messages })
  } catch (error) {
    res.status(503).json({
      error: error instanceof Error ? error.message : 'LIVE_FEED_FAILED',
    })
  }
}
