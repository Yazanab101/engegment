import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import './live.css'

type Tab = 'all' | 'photos' | 'videos' | 'messages'
type ViewMode = 'guests' | 'media'

type GuestCard = {
  id: string
  name: string
  table?: string | null
  photos: number
  videos: number
  messages: number
  firstUpload?: string | null
  lastUpload?: string | null
  lastSeenAt?: string
  createdAt?: string
  latestThumb?: { type?: string; thumbUrl?: string | null; url?: string | null } | null
}

type Overview = {
  guests: number
  photos: number
  videos: number
  messages: number
  event?: { coupleNames?: string }
}

type MediaItem = {
  id: string
  type: string
  guestName: string
  caption: string | null
  createdAt: string
  thumbUrl: string | null
  url: string | null
}

type MessageItem = {
  id: string
  guestName: string
  message: string
  createdAt: string
}

type Feed = {
  overview: Overview
  guest?: GuestCard | null
  guests?: { items: GuestCard[]; page: number; total: number; hasMore: boolean }
  media: { items: MediaItem[]; page: number; total: number; hasMore: boolean }
  messages: MessageItem[]
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'photos', label: 'صور' },
  { id: 'videos', label: 'فيديو' },
  { id: 'messages', label: 'رسائل' },
]

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
  })
}

function sameMediaIds(a: MediaItem[], b: MediaItem[]) {
  if (a.length !== b.length) return false
  return a.every((item, index) => item.id === b[index]?.id)
}

function sameGuestIds(a: GuestCard[], b: GuestCard[]) {
  if (a.length !== b.length) return false
  return a.every((item, index) => item.id === b[index]?.id)
}

function keepGuestCovers(prev: GuestCard[], next: GuestCard[]) {
  const old = new Map(prev.map((item) => [item.id, item]))
  return next.map((item) => {
    const kept = old.get(item.id)
    const thumb = kept?.latestThumb
    if (!thumb?.thumbUrl || !item.latestThumb) return item
    return {
      ...item,
      latestThumb: {
        ...item.latestThumb,
        thumbUrl: thumb.thumbUrl || item.latestThumb.thumbUrl,
        url: thumb.url || item.latestThumb.url,
      },
    }
  })
}

function keepLoadedUrls(prev: MediaItem[], next: MediaItem[]) {
  const old = new Map(prev.map((item) => [item.id, item]))
  return next.map((item) => {
    const kept = old.get(item.id)
    if (!kept) return item
    return {
      ...item,
      thumbUrl: kept.thumbUrl || item.thumbUrl,
      url: kept.url || item.url,
    }
  })
}

function FrozenThumb({ id, src, eager }: { id: string; src: string | null; eager: boolean }) {
  const heldId = useRef(id)
  const heldSrc = useRef(src)
  if (heldId.current !== id) {
    heldId.current = id
    heldSrc.current = src
  } else if (src && !heldSrc.current) {
    heldSrc.current = src
  }
  if (!heldSrc.current) return null
  return <img src={heldSrc.current} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" draggable={false} />
}

async function liveRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  const body = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) {
    throw new Error(body.error || 'REQUEST_FAILED')
  }
  return body
}

export function LiveDashboard() {
  const [ready, setReady] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [username, setUsername] = useState('yazan')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<Tab>('all')
  const [page, setPage] = useState(1)
  const [feed, setFeed] = useState<Feed | null>(null)
  const [items, setItems] = useState<MediaItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [viewer, setViewer] = useState<{ url: string; type: string } | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<ViewMode>('guests')
  const [guestId, setGuestId] = useState('')
  const [guests, setGuests] = useState<GuestCard[]>([])
  const mediaTabRef = useRef(tab)

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 280)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const load = useCallback(async (nextPage = 1, replace = true) => {
    const params = new URLSearchParams({ tab, page: String(nextPage), view })
    if (search && !guestId) params.set('search', search)
    if (guestId) params.set('guestId', guestId)
    const data = await liveRequest<Feed>(`/api/live-dash?${params.toString()}`)
    setFeed((prev) => {
      if (
        prev &&
        prev.overview.guests === data.overview.guests &&
        prev.overview.photos === data.overview.photos &&
        prev.overview.videos === data.overview.videos &&
        prev.overview.messages === data.overview.messages
      ) {
        return {
          ...prev,
          media: tab === 'messages' ? prev.media : data.media,
          messages: data.messages.length ? data.messages : prev.messages,
        }
      }
      return data
    })
    setGuests((prev) => {
      if (guestId) return prev
      const incoming = keepGuestCovers(prev, data.guests?.items ?? [])
      if (!replace) {
        const seen = new Set(prev.map((item) => item.id))
        return [...prev, ...incoming.filter((item) => !seen.has(item.id))]
      }
      if (nextPage === 1 && prev.length > incoming.length) {
        const firstIds = new Set(incoming.map((item) => item.id))
        return [...incoming, ...prev.filter((item) => !firstIds.has(item.id))]
      }
      if (sameGuestIds(prev, incoming)) return prev
      return incoming
    })
    setItems((prev) => {
      if (view === 'guests' && !guestId) return []
      if (tab === 'messages') return prev
      const incoming = keepLoadedUrls(prev, data.media.items)
      if (search) {
        if (sameMediaIds(prev, incoming)) return prev
        return incoming
      }
      const tabChanged = mediaTabRef.current !== tab
      mediaTabRef.current = tab
      if (tabChanged) return incoming
      if (!replace) {
        const seen = new Set(prev.map((item) => item.id))
        return [...prev, ...incoming.filter((item) => !seen.has(item.id))]
      }
      if (nextPage === 1 && prev.length > incoming.length) {
        const firstIds = new Set(incoming.map((item) => item.id))
        return [...incoming, ...prev.filter((item) => !firstIds.has(item.id))]
      }
      if (sameMediaIds(prev, incoming)) return prev
      return incoming
    })
    setPage(nextPage)
    setError(null)
    return data
  }, [tab, search, view, guestId])

  useEffect(() => {
    void liveRequest('/api/live-dash?ping=1')
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false))
      .finally(() => setReady(true))
  }, [])

  useEffect(() => {
    if (!authed) return
    void load(1, true).catch((err: Error) => setError(err.message))
  }, [authed, load])

  useEffect(() => {
    if (!authed) return
    const tick = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void load(1, true).catch(() => undefined)
    }, 12000)
    return () => window.clearInterval(tick)
  }, [authed, load])

  async function onLogin(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setLoginError(null)
    try {
      await liveRequest('/api/live-dash', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
      setAuthed(true)
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'ما قدرنا نسجل دخول')
    } finally {
      setBusy(false)
    }
  }

  async function openItem(item: MediaItem) {
    try {
      const signed = item.url
        ? { url: item.url }
        : await liveRequest<{ url: string }>(`/api/live-dash?signed=${encodeURIComponent(item.id)}`)
      setViewer({ url: signed.url, type: item.type })
    } catch {
      if (item.thumbUrl) setViewer({ url: item.thumbUrl, type: item.type === 'video' ? 'photo' : item.type })
    }
  }

  if (!ready) {
    return (
      <div className="live-root" dir="rtl" lang="ar">
        <p className="live-empty">جاري فتح الداشبورد…</p>
      </div>
    )
  }

  if (!authed) {
    return (
      <div className="live-root" dir="rtl" lang="ar">
        <div className="live-login">
          <form onSubmit={onLogin}>
            <h1>داشبورد الخطوبة</h1>
            <p>شوف صور وفيديو ورسائل الضيوف لحظة بلحظة</p>
            <label>
              اليوزر نيم
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                required
              />
            </label>
            <label>
              كلمة السر
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                minLength={8}
              />
            </label>
            {loginError ? <p className="live-error">{loginError}</p> : null}
            <button className="live-btn" type="submit" disabled={busy}>
              {busy ? 'جاري الدخول…' : 'دخول'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  const overview = feed?.overview
  const messages = feed?.messages ?? []

  return (
    <div className="live-root" dir="rtl" lang="ar">
      <div className="live-shell">
        <header className="live-top">
          <div className="live-brand">
            <strong>{overview?.event?.coupleNames || 'يزن & نورا'}</strong>
            <span>داشبورد المشاركات · يتحدث لحاله</span>
          </div>
          <div className="live-top-actions">
            <span className="live-pulse">
              <i />
              مباشر
            </span>
            <button
              className="live-btn-quiet"
              type="button"
              onClick={() => void load(1, true)}
            >
              تحديث
            </button>
            <button
              className="live-btn-quiet"
              type="button"
              onClick={async () => {
                await liveRequest('/api/live-dash', {
                  method: 'POST',
                  body: JSON.stringify({ action: 'logout' }),
                })
                setAuthed(false)
                setFeed(null)
                setItems([])
                setGuests([])
                setGuestId('')
              }}
            >
              خروج
            </button>
          </div>
        </header>

        <section className="live-stats">
          <div className="live-stat">
            <span>ضيوف</span>
            <strong>{overview?.guests ?? 0}</strong>
          </div>
          <div className="live-stat">
            <span>صور</span>
            <strong>{overview?.photos ?? 0}</strong>
          </div>
          <div className="live-stat">
            <span>فيديو</span>
            <strong>{overview?.videos ?? 0}</strong>
          </div>
          <div className="live-stat">
            <span>رسائل</span>
            <strong>{overview?.messages ?? 0}</strong>
          </div>
        </section>

        <label className="live-search">
          <input
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value)
              setPage(1)
            }}
            placeholder="ابحث بالاسم أو آخر 4 أرقام"
            autoComplete="off"
            autoCapitalize="none"
          />
        </label>

        <nav className="live-tabs">
          <button
            className="live-btn-quiet"
            type="button"
            aria-selected={view === 'guests' && !guestId}
            onClick={() => {
              setView('guests')
              setGuestId('')
              setTab('all')
              setPage(1)
            }}
          >
            حسب الضيف
          </button>
          <button
            className="live-btn-quiet"
            type="button"
            aria-selected={view === 'media' && !guestId}
            onClick={() => {
              setView('media')
              setGuestId('')
              setPage(1)
            }}
          >
            كل الوسائط
          </button>
        </nav>

        {guestId ? (
          <div className="live-guest-head">
            <button
              className="live-btn-quiet"
              type="button"
              onClick={() => {
                setGuestId('')
                setTab('all')
                setPage(1)
                setItems([])
              }}
            >
              رجوع لكل الضيوف
            </button>
            <div>
              <strong>{feed?.guest?.name || 'الضيف'}</strong>
              <p>
                {feed?.guest?.photos ?? 0} صور · {feed?.guest?.videos ?? 0} فيديو · {feed?.guest?.messages ?? 0} رسائل
                {feed?.guest?.table ? ` · طاولة ${feed.guest.table}` : ''}
              </p>
              <p className="live-muted">
                أول زيارة: {feed?.guest?.createdAt ? formatTime(feed.guest.createdAt) : '—'}
                {' · '}
                آخر نشاط: {feed?.guest?.lastUpload || feed?.guest?.lastSeenAt
                  ? formatTime(String(feed?.guest?.lastUpload || feed?.guest?.lastSeenAt))
                  : '—'}
              </p>
            </div>
          </div>
        ) : null}

        {(view === 'media' || guestId) ? (
          <nav className="live-tabs">
            {TABS.map((item) => (
              <button
                key={item.id}
                className="live-btn-quiet"
                type="button"
                aria-selected={tab === item.id}
                onClick={() => {
                  setTab(item.id)
                  setPage(1)
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>
        ) : null}

        {error ? <p className="live-error">{error}</p> : null}

        {view === 'guests' && !guestId ? (
          <>
            {guests.length === 0 ? (
              <p className="live-empty">
                {search ? 'ما لقينا حدا بهالاسم أو الرقم.' : 'ما في ضيوف بعد. أول ما يبعتوا شي بيظهر هون.'}
              </p>
            ) : null}
            <div className="live-guest-grid">
              {guests.map((guest, index) => (
                <button
                  key={guest.id}
                  className="live-card"
                  type="button"
                  onClick={() => {
                    setGuestId(guest.id)
                    setTab('all')
                    setPage(1)
                    setView('guests')
                  }}
                >
                  <div className="live-thumb live-thumb-cover">
                    {guest.latestThumb?.thumbUrl || guest.latestThumb?.url ? (
                      <FrozenThumb
                        id={guest.id}
                        src={guest.latestThumb.thumbUrl || guest.latestThumb.url || null}
                        eager={index < 8}
                      />
                    ) : (
                      <span className="live-guest-fallback">{guest.name.slice(0, 1)}</span>
                    )}
                    {guest.latestThumb?.type === 'video' ? <span className="live-play">فيديو</span> : null}
                  </div>
                  <div className="live-card-meta">
                    <strong>{guest.name}</strong>
                    <p>
                      {guest.photos} صور · {guest.videos} فيديو
                      {guest.messages ? ` · ${guest.messages} رسائل` : ''}
                    </p>
                    <p>
                      {(guest.photos || 0) + (guest.videos || 0)} ذكريات
                      {guest.table ? ` · طاولة ${guest.table}` : ''}
                    </p>
                    <p>
                      {guest.lastUpload || guest.lastSeenAt
                        ? formatTime(String(guest.lastUpload || guest.lastSeenAt))
                        : 'ما في نشاط بعد'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            {feed?.guests?.hasMore ? (
              <div className="live-more">
                <button
                  className="live-btn-quiet"
                  type="button"
                  onClick={() => void load(page + 1, false)}
                >
                  تحميل المزيد
                </button>
              </div>
            ) : null}
          </>
        ) : tab === 'messages' ? (
          <div className="live-messages">
            {messages.length === 0 ? (
              <p className="live-empty">{search || guestId ? 'ما لقينا رسائل لهالشخص.' : 'ما في رسائل بعد.'}</p>
            ) : null}
            {messages.map((item) => (
              <article key={item.id} className="live-message">
                <strong>{item.guestName}</strong>
                <span className="live-muted"> {formatTime(item.createdAt)}</span>
                <p>{item.message}</p>
              </article>
            ))}
          </div>
        ) : (
          <>
            {items.length === 0 ? (
              <p className="live-empty">
                {search ? 'ما لقينا حدا بهالاسم أو الرقم.' : 'ما في مشاركات بعد. أول ما يبعتوا شي بيظهر هون.'}
              </p>
            ) : null}
            <div className="live-grid">
              {items.map((item, index) => (
                <button key={item.id} className="live-card" type="button" onClick={() => void openItem(item)}>
                  <div className="live-thumb">
                    <FrozenThumb id={item.id} src={item.thumbUrl} eager={index < 12} />
                    {item.type === 'video' ? <span className="live-play">فيديو</span> : null}
                  </div>
                  <div className="live-card-meta">
                    <strong>{item.guestName}</strong>
                    <p>
                      {formatTime(item.createdAt)}
                      {item.caption ? ` · ${item.caption}` : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            {feed?.media.hasMore && !search ? (
              <div className="live-more">
                <button
                  className="live-btn-quiet"
                  type="button"
                  onClick={() => void load(page + 1, false)}
                >
                  تحميل المزيد
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>

      {viewer ? (
        <div className="live-viewer" onClick={() => setViewer(null)}>
          <button className="live-btn-quiet" type="button" onClick={() => setViewer(null)}>
            إغلاق
          </button>
          {viewer.type === 'video' ? (
            <video src={viewer.url} controls autoPlay playsInline onClick={(e) => e.stopPropagation()} />
          ) : (
            <img src={viewer.url} alt="" onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      ) : null}
    </div>
  )
}
