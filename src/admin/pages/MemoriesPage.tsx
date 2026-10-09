import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type MemoriesGuest, type MemoriesOverview } from '../../api/client'
import { VideoPoster } from '../../moments/VideoPoster'

function formatBytes(bytes: number) {
  if (!bytes) return '0 MB'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
  }
  return `${value.toFixed(value >= 10 || i < 2 ? 0 : 1)} ${units[i]}`
}

function formatTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: 'short',
  })
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

async function downloadAll(guestId: string) {
  const files = await api.memoriesGuestDownloadUrls(guestId)
  for (const file of files) {
    const a = document.createElement('a')
    a.href = file.url
    a.download = file.filename
    a.target = '_blank'
    a.rel = 'noopener'
    a.click()
    await new Promise((resolve) => window.setTimeout(resolve, 250))
  }
}

export function MemoriesPage() {
  const [overview, setOverview] = useState<MemoriesOverview | null>(null)
  const [guests, setGuests] = useState<MemoriesGuest[]>([])
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('activity')
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    const [nextOverview, nextGuests] = await Promise.all([
      api.memoriesOverview(),
      api.memoriesGuests(new URLSearchParams({ search, sort })),
    ])
    setOverview(nextOverview)
    setGuests(nextGuests)
  }

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message))
  }, [search, sort])

  if (!overview) return <p>{error ?? 'Loading memories…'}</p>

  return (
    <div>
      <div className="admin-top">
        <h1>Memories</h1>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <Link to="/moments/qr" className="admin-btn secondary">
            QR code
          </Link>
          <Link to="/admin/memories/stories" className="admin-btn secondary">
            Stories
          </Link>
          <button
            className="admin-btn secondary"
            type="button"
            onClick={() => void api.memoriesSetUploadsOpen(!overview.event.uploadsOpen).then(() => load())}
          >
            {overview.event.uploadsOpen ? 'Close uploads' : 'Open uploads'}
          </button>
        </div>
      </div>

      <div className="admin-cards">
        <div className="admin-card">
          <span>Participants</span>
          <strong>{overview.guests}</strong>
        </div>
        <div className="admin-card">
          <span>Photos</span>
          <strong>{overview.photos}</strong>
        </div>
        <div className="admin-card">
          <span>Videos</span>
          <strong>{overview.videos}</strong>
        </div>
        <div className="admin-card">
          <span>Messages</span>
          <strong>{overview.messages}</strong>
        </div>
        <div className="admin-card">
          <span>Storage</span>
          <strong>{formatBytes(overview.storageBytes)}</strong>
        </div>
      </div>

      <div className="admin-toolbar">
        <input value={search} placeholder="Search guests" onChange={(e) => setSearch(e.target.value)} />
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="activity">Last activity</option>
          <option value="name">Name</option>
          <option value="photos">Most photos</option>
          <option value="videos">Most videos</option>
          <option value="uploads">Most uploads</option>
        </select>
      </div>

      {guests.length === 0 ? (
        <p className="admin-muted">No memory guests yet.</p>
      ) : (
        <div className="admin-guest-grid">
          {guests.map((guest) => (
            <article key={guest.id} className="admin-guest-card">
              <div className="admin-guest-card-top">
                {guest.latestThumb?.thumbUrl || (guest.latestThumb?.type === 'video' && guest.latestThumb.url) ? (
                  guest.latestThumb.type === 'video' ? (
                    <VideoPoster
                      className="admin-guest-thumb"
                      src={guest.latestThumb.url}
                      poster={guest.latestThumb.thumbUrl}
                      captureSrc={
                        guest.latestThumb.mediaId
                          ? `/api/admin/memories/media/${guest.latestThumb.mediaId}/file`
                          : null
                      }
                    />
                  ) : (
                    <img className="admin-guest-thumb" src={guest.latestThumb.thumbUrl ?? ''} alt="" />
                  )
                ) : (
                  <div className="admin-guest-initials">{initials(guest.name)}</div>
                )}
                <div>
                  <h2>{guest.name}</h2>
                  {guest.table ? <p>Table {guest.table}</p> : null}
                </div>
              </div>
              <dl className="admin-guest-stats">
                <div>
                  <dt>Photos</dt>
                  <dd>{guest.photos}</dd>
                </div>
                <div>
                  <dt>Videos</dt>
                  <dd>{guest.videos}</dd>
                </div>
                <div>
                  <dt>Messages</dt>
                  <dd>{guest.messages}</dd>
                </div>
                <div>
                  <dt>Sessions</dt>
                  <dd>{guest.sessions}</dd>
                </div>
              </dl>
              <p className="admin-guest-meta">
                First: {formatTime(guest.firstUpload)}
                <br />
                Last: {formatTime(guest.lastUpload)}
              </p>
              <div className="admin-guest-actions">
                <Link className="admin-btn" to={`/admin/memories/guest/${guest.id}`}>
                  View Guest
                </Link>
                <button className="admin-btn secondary" type="button" onClick={() => void downloadAll(guest.id)}>
                  Download All
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
