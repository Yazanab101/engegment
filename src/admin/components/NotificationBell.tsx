import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type AdminNotification } from '../../api/client'

const SEEN_KEY = 'engegment.admin.notifications.seenAt'

function readSeenAt(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY)
  } catch {
    return null
  }
}

function writeSeenAt(iso: string) {
  try {
    localStorage.setItem(SEEN_KEY, iso)
  } catch {
    /* ignore */
  }
}

function formatWhen(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('ar', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function kindClass(kind: AdminNotification['kind']) {
  if (kind === 'attending') return 'is-ok'
  if (kind === 'not_attending') return 'is-bad'
  if (kind === 'message') return 'is-msg'
  return 'is-muted'
}

export function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AdminNotification[]>([])
  const [seenAt, setSeenAt] = useState<string | null>(() => readSeenAt())

  const load = useCallback(async () => {
    const data = await api.notifications()
    setItems(data.items)
  }, [])

  useEffect(() => {
    void load().catch(() => undefined)
    const id = window.setInterval(() => void load().catch(() => undefined), 15000)
    return () => window.clearInterval(id)
  }, [load])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null
      if (target?.closest('[data-admin-notifications]')) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const unreadCount = useMemo(() => {
    if (!seenAt) return items.length
    const seen = new Date(seenAt).getTime()
    return items.filter((item) => new Date(item.createdAt).getTime() > seen).length
  }, [items, seenAt])

  function markAllSeen() {
    const latest = items[0]?.createdAt ?? new Date().toISOString()
    writeSeenAt(latest)
    setSeenAt(latest)
  }

  function openPanel() {
    const next = !open
    setOpen(next)
    if (next) markAllSeen()
  }

  function openItem(item: AdminNotification) {
    setOpen(false)
    markAllSeen()
    navigate(item.href)
  }

  return (
    <div className="admin-notify" data-admin-notifications>
      <button
        type="button"
        className={`admin-notify-bell${unreadCount > 0 ? ' has-unread' : ''}`}
        aria-label="Notifications"
        aria-expanded={open}
        onClick={openPanel}
      >
        <span aria-hidden>🔔</span>
        {unreadCount > 0 ? (
          <span className="admin-notify-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        ) : null}
      </button>

      {open ? (
        <div className="admin-notify-panel" role="menu">
          <div className="admin-notify-head">
            <strong>إشعارات</strong>
            <button type="button" className="admin-btn secondary" onClick={markAllSeen}>
              تعليم كمقروء
            </button>
          </div>
          {items.length === 0 ? (
            <p className="admin-notify-empty">ما في إشعارات بعد</p>
          ) : (
            <ul className="admin-notify-list">
              {items.map((item) => {
                const unread =
                  !seenAt || new Date(item.createdAt).getTime() > new Date(seenAt).getTime()
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`admin-notify-item ${kindClass(item.kind)}${unread ? ' is-unread' : ''}`}
                      onClick={() => openItem(item)}
                    >
                      <span className="admin-notify-title">{item.title}</span>
                      <span className="admin-notify-body">{item.body}</span>
                      <span className="admin-notify-time">{formatWhen(item.createdAt)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
