import { useEffect, useState } from 'react'
import { api } from '../../api/client'

type Stats = {
  totalInvitedPeople: number
  totalInvitationLinks: number
  openedInvitations: number
  notOpened: number
  rsvpResponses: number
  attendingInvitations: number
  notAttending: number
  totalPeopleAttending: number
  pendingResponse: number
  openRate: number
  rsvpRate: number
  byLanguage: Array<{
    language: string
    invitations: number
    attendingInvitations: number
    peopleAttending: number
  }>
}

export function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    let alive = true
    const load = () => {
      api
        .dashboard()
        .then((data) => {
          if (alive) setStats(data as Stats)
        })
        .catch(() => undefined)
    }
    load()
    const id = window.setInterval(load, 25000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  if (!stats) return <p>Loading dashboard…</p>

  const cards = [
    ['Total invited people', stats.totalInvitedPeople],
    ['Invitation links', stats.totalInvitationLinks],
    ['Opened', stats.openedInvitations],
    ['Not opened', stats.notOpened],
    ['RSVP responses', stats.rsvpResponses],
    ['Attending invitations', stats.attendingInvitations],
    ['Not attending', stats.notAttending],
    ['People attending', stats.totalPeopleAttending],
    ['Pending response', stats.pendingResponse],
  ] as const

  return (
    <div>
      <div className="admin-top">
        <h1>Dashboard</h1>
      </div>
      <div className="admin-cards">
        {cards.map(([label, value]) => (
          <div className="admin-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className="admin-card" style={{ marginBottom: '1rem' }}>
        <span>Analytics</span>
        <p style={{ margin: '0.6rem 0 0' }}>
          Open rate: {(stats.openRate * 100).toFixed(1)}% · RSVP rate:{' '}
          {(stats.rsvpRate * 100).toFixed(1)}%
        </p>
      </div>

      <div className="admin-cards">
        {stats.byLanguage.map((row) => (
          <div className="admin-card" key={row.language}>
            <span>{row.language}</span>
            <strong>{row.peopleAttending}</strong>
            <p style={{ margin: '0.35rem 0 0', color: 'var(--admin-muted)', fontSize: '0.85rem' }}>
              {row.attendingInvitations}/{row.invitations} invitations attending
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
