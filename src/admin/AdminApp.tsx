import { Navigate, Route, Routes } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { AdminLogin } from './pages/AdminLogin'
import { AdminLayout } from './components/AdminLayout'
import { DashboardPage } from './pages/DashboardPage'
import { GuestsPage } from './pages/GuestsPage'
import { EventSettingsPage } from './pages/EventSettingsPage'
import './styles/admin.css'

export function AdminApp() {
  const [ready, setReady] = useState(false)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    api
      .adminMe()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false))
      .finally(() => setReady(true))
  }, [])

  if (!ready) return <div className="admin-loading">Loading…</div>

  if (!authed) {
    return (
      <Routes>
        <Route path="login" element={<AdminLogin onSuccess={() => setAuthed(true)} />} />
        <Route path="*" element={<Navigate to="/admin/login" replace />} />
      </Routes>
    )
  }

  return (
    <AdminLayout
      onLogout={async () => {
        await api.adminLogout()
        setAuthed(false)
      }}
    >
      <Routes>
        <Route index element={<DashboardPage />} />
        <Route path="guests" element={<GuestsPage />} />
        <Route path="settings" element={<EventSettingsPage />} />
        <Route path="login" element={<Navigate to="/admin" replace />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminLayout>
  )
}
