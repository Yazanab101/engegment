import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'

type AttendingGuest = {
  id: string
  name: string
  side: 'groom' | 'bride' | 'none'
  sideLabel: string
  guestCount: number
  language: string
}

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
  bySide: Array<{
    side: 'groom' | 'bride' | 'none'
    label: string
    invitations: number
    peopleAttending: number
  }>
  attendingGuests: AttendingGuest[]
}

export function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [sideFilter, setSideFilter] = useState<'all' | 'groom' | 'bride' | 'none'>('all')

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

  const attendingRows = useMemo(() => {
    if (!stats?.attendingGuests) return []
    if (sideFilter === 'all') return stats.attendingGuests
    return stats.attendingGuests.filter((g) => g.side === sideFilter)
  }, [stats, sideFilter])

  const attendingTotal = useMemo(
    () => attendingRows.reduce((sum, g) => sum + g.guestCount, 0),
    [attendingRows],
  )

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

  const bySide = stats.bySide ?? []
  const groom = bySide.find((s) => s.side === 'groom')
  const bride = bySide.find((s) => s.side === 'bride')
  const unassigned = bySide.find((s) => s.side === 'none')

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

      <h2 className="admin-section-title">الحضور حسب الطرف</h2>
      <div className="admin-cards">
        <div className="admin-card admin-card-groom">
          <span>أهل العريس</span>
          <strong>{groom?.peopleAttending ?? 0}</strong>
          <p className="admin-card-meta">
            {groom?.invitations ?? 0} دعوة مؤكدة
          </p>
        </div>
        <div className="admin-card admin-card-bride">
          <span>أهل العروس</span>
          <strong>{bride?.peopleAttending ?? 0}</strong>
          <p className="admin-card-meta">
            {bride?.invitations ?? 0} دعوة مؤكدة
          </p>
        </div>
        <div className="admin-card">
          <span>بدون تعيين</span>
          <strong>{unassigned?.peopleAttending ?? 0}</strong>
          <p className="admin-card-meta">
            {unassigned?.invitations ?? 0} دعوة مؤكدة
          </p>
        </div>
        <div className="admin-card">
          <span>المجموع الكلي</span>
          <strong>{stats.totalPeopleAttending}</strong>
          <p className="admin-card-meta">
            {stats.attendingInvitations} دعوة مؤكدة
          </p>
        </div>
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
            <p className="admin-card-meta">
              {row.attendingInvitations}/{row.invitations} invitations attending
            </p>
          </div>
        ))}
      </div>

      <div className="admin-top" style={{ marginTop: '1.25rem' }}>
        <h2 className="admin-section-title" style={{ margin: 0 }}>
          مين جاي وكم شخص
        </h2>
        <div className="admin-actions">
          {(
            [
              ['all', 'الكل'],
              ['groom', 'أهل العريس'],
              ['bride', 'أهل العروس'],
              ['none', 'بدون تعيين'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`admin-btn${sideFilter === value ? '' : ' secondary'}`}
              onClick={() => setSideFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>#</th>
              <th>الاسم</th>
              <th>الطرف</th>
              <th>عدد الأشخاص</th>
            </tr>
          </thead>
          <tbody>
            {attendingRows.length === 0 ? (
              <tr>
                <td colSpan={4}>لا يوجد حضور مؤكد بعد</td>
              </tr>
            ) : (
              attendingRows.map((g, index) => (
                <tr
                  key={g.id}
                  className={
                    g.side === 'groom'
                      ? 'admin-row-groom'
                      : g.side === 'bride'
                        ? 'admin-row-bride'
                        : undefined
                  }
                >
                  <td>{index + 1}</td>
                  <td>
                    <strong>{g.name}</strong>
                  </td>
                  <td>
                    <span
                      className={
                        g.side === 'groom'
                          ? 'badge side-groom'
                          : g.side === 'bride'
                            ? 'badge side-bride'
                            : 'badge pending'
                      }
                    >
                      {g.sideLabel}
                    </span>
                  </td>
                  <td>
                    <strong>{g.guestCount}</strong>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {attendingRows.length > 0 && (
            <tfoot>
              <tr className="admin-total-row">
                <td colSpan={3}>
                  <strong>المجموع</strong>
                  <span className="admin-total-meta">
                    {' '}
                    ({attendingRows.length} دعوة)
                  </span>
                </td>
                <td>
                  <strong>{attendingTotal}</strong>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
