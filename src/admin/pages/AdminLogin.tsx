import type { FormEvent } from 'react'
import { useState } from 'react'
import { api } from '../../api/client'

export function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.adminLogin(email, password)
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
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
