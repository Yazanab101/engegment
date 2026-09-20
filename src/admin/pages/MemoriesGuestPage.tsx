import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  api,
  type MemoriesGuest,
  type MemoriesMediaPage,
  type MemoriesMessage,
} from '../../api/client'
import { VideoPoster } from '../../moments/VideoPoster'

function formatTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: 'short',
  })
}

export function MemoriesGuestPage() {
  const { guestId } = useParams<{ guestId: string }>()
  const [guest, setGuest] = useState<MemoriesGuest | null>(null)
  const [media, setMedia] = useState<MemoriesMediaPage['items']>([])
  const [messages, setMessages] = useState<MemoriesMessage[]>([])
  const [tab, setTab] = useState<'all' | 'photos' | 'videos' | 'messages' | 'favorites'>('all')
  const [error, setError] = useState<string | null>(null)
  const [viewer, setViewer] = useState<{ url: string; type: string } | null>(null)

  const load = async () => {
    if (!guestId) return
    const filter = tab === 'photos' ? 'photos' : tab === 'videos' ? 'videos' : tab === 'favorites' ? 'favorites' : 'all'
    const [nextGuest, nextMedia, nextMessages] = await Promise.all([
      api.memoriesGuest(guestId),
      tab === 'messages'
        ? Promise.resolve({ items: [] as MemoriesMediaPage['items'] })
        : api.memoriesMedia(new URLSearchParams({ filter, guestId, limit: '200' })),
      api.memoriesMessages(false, guestId),
    ])
    setGuest(nextGuest)
    setMedia(nextMedia.items)
    setMessages(nextMessages)
  }

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message))
  }, [guestId, tab])

  if (!guest) return <p>{error ?? 'Loading guest…'}</p>

  return (
    <div>
      <div className="admin-top">
        <div>
          <Link className="admin-back" to="/admin/memories">
            ← All guests
          </Link>
          <h1>{guest.name}</h1>
        </div>
        <button
          className="admin-btn secondary"
          type="button"
          onClick={async () => {
            const files = await api.memoriesGuestDownloadUrls(guest.id)
            for (const file of files) {
              const a = document.createElement('a')
              a.href = file.url
              a.download = file.filename
              a.target = '_blank'
              a.rel = 'noopener'
              a.click()
              await new Promise((resolve) => window.setTimeout(resolve, 250))
            }
          }}
        >
          Download All
        </button>
      </div>

      <div className="admin-cards">
        <div className="admin-card">
          <span>Photos</span>
          <strong>{guest.photos}</strong>
        </div>
        <div className="admin-card">
          <span>Videos</span>
          <strong>{guest.videos}</strong>
        </div>
        <div className="admin-card">
          <span>Messages</span>
          <strong>{guest.messages}</strong>
        </div>
        <div className="admin-card">
          <span>Sessions</span>
          <strong>{guest.sessions}</strong>
        </div>
        <div className="admin-card">
          <span>First upload</span>
          <strong style={{ fontSize: '1rem' }}>{formatTime(guest.firstUpload)}</strong>
        </div>
        <div className="admin-card">
          <span>Last upload</span>
          <strong style={{ fontSize: '1rem' }}>{formatTime(guest.lastUpload)}</strong>
        </div>
      </div>

      <div className="admin-toolbar">
        {(['all', 'photos', 'videos', 'messages', 'favorites'] as const).map((item) => (
          <button key={item} className="admin-btn secondary" type="button" onClick={() => setTab(item)}>
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'messages' ? (
        <div className="admin-cards">
          {messages.length === 0 ? <p>No messages from this guest.</p> : null}
          {messages.map((item) => (
            <div key={item.id} className="admin-card">
              <p>{item.message}</p>
              <span>{formatTime(item.createdAt)}</span>
              <div className="admin-bulk-actions">
                <button
                  className="admin-btn secondary"
                  type="button"
                  onClick={() => void api.memoriesMessageAction(item.id, item.isFavorite ? 'unfavorite' : 'favorite').then(load)}
                >
                  {item.isFavorite ? 'Unfavorite' : 'Favorite'}
                </button>
                <button className="admin-btn danger" type="button" onClick={() => void api.memoriesMessageAction(item.id, 'delete').then(load)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="admin-media-grid">
          {media.length === 0 ? <p>No media in this view.</p> : null}
          {media.map((item) => (
            <article key={item.id} className="admin-media-card">
              <button
                className="admin-media-preview"
                type="button"
                onClick={() => setViewer({ url: item.url || item.thumbUrl || '', type: item.type })}
              >
                {item.type === 'video' ? (
                  <VideoPoster
                    src={item.url}
                    poster={item.thumbUrl}
                    captureSrc={`/api/admin/memories/media/${item.id}/file`}
                  />
                ) : item.thumbUrl ? (
                  <img src={item.thumbUrl} alt="" />
                ) : (
                  <div />
                )}
                {item.type === 'video' && <span className="admin-media-play">Play</span>}
              </button>
              {item.caption ? <p className="admin-media-caption">{item.caption}</p> : null}
              <div className="admin-bulk-actions">
                <button
                  className="admin-btn secondary"
                  type="button"
                  onClick={() => void api.memoriesMediaAction([item.id], item.isFavorite ? 'unfavorite' : 'favorite').then(load)}
                >
                  {item.isFavorite ? 'Unfavorite' : 'Favorite'}
                </button>
                <button
                  className="admin-btn secondary"
                  type="button"
                  onClick={() => void api.memoriesMediaAction([item.id], item.isHidden ? 'unhide' : 'hide').then(load)}
                >
                  {item.isHidden ? 'Unhide' : 'Hide'}
                </button>
                <button
                  className="admin-btn secondary"
                  type="button"
                  onClick={async () => {
                    const signed = item.url ? { url: item.url } : await api.memoriesSignedUrl(item.id)
                    const a = document.createElement('a')
                    a.href = signed.url
                    a.download = item.type === 'video' ? 'memory.mp4' : 'memory.jpg'
                    a.target = '_blank'
                    a.rel = 'noopener'
                    a.click()
                  }}
                >
                  Download
                </button>
                <button
                  className="admin-btn danger"
                  type="button"
                  onClick={() => {
                    if (!window.confirm('Delete this memory?')) return
                    void api.memoriesMediaAction([item.id], 'delete').then(load)
                  }}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {viewer?.url && (
        <div className="admin-lightbox" onClick={() => setViewer(null)}>
          <button className="admin-btn secondary admin-lightbox-close" type="button" onClick={() => setViewer(null)}>
            Close
          </button>
          {viewer.type === 'video' ? (
            <video src={viewer.url} controls autoPlay playsInline onClick={(e) => e.stopPropagation()} />
          ) : (
            <img src={viewer.url} alt="" onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      )}
    </div>
  )
}
