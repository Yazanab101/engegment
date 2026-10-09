import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'
import { NotificationBell } from './NotificationBell'

export function AdminLayout({
  children,
  onLogout,
}: {
  children: ReactNode
  onLogout: () => void | Promise<void>
}) {
  return (
    <div className="admin-shell">
      <aside className="admin-nav">
        <strong style={{ padding: '0.35rem 0.75rem', marginBottom: '0.5rem' }}>Engegment</strong>
        <NavLink to="/admin" end>
          Dashboard
        </NavLink>
        <NavLink to="/admin/guests">Guests</NavLink>
        <NavLink to="/admin/settings">Event settings</NavLink>
        <NavLink to="/admin/memories">Memories</NavLink>
        <NavLink to="/moments/qr">QR</NavLink>
        <NavLink to="/admin/memories/stories">Stories</NavLink>
        <button className="admin-btn secondary" type="button" onClick={() => void onLogout()} style={{ marginTop: 'auto' }}>
          Log out
        </button>
      </aside>
      <div className="admin-content">
        <header className="admin-topbar">
          <NotificationBell />
        </header>
        <main className="admin-main">{children}</main>
      </div>
    </div>
  )
}
