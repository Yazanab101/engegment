import type { FormEvent } from 'react'
import { useState } from 'react'
import { api } from '../../api/client'

export function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.adminLogin(username, password)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-login">
      <form onSubmit={onSubmit}>
        <h1>Admin</h1>
        <p style={{ margin: 0, color: 'var(--admin-muted)' }}>Wedding invitation dashboard</p>
        <label>
          Username
          <input
            type="text"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={32}
            pattern="[a-zA-Z0-9._-]+"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>
        {error && <p className="admin-error">{error}</p>}
        <button className="admin-btn" type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
