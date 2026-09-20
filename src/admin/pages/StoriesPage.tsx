import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type AdminStory } from '../../api/client'
import { formatBytes, prepareFile } from '../../moments/media-utils'
import {
  PHOTO_STORY_DEFAULT_SECONDS,
  PHOTO_STORY_MAX_SECONDS,
  PHOTO_STORY_MIN_SECONDS,
  STORY_MAX_SECONDS,
  type StoryExpireMode,
} from '../../moments/story-config'
import { StoryViewer, type StoryItem } from '../../moments/StoryViewer'

function putBlob(url: string, blob: Blob, mimeType: string, onProgress?: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', mimeType)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
        return
      }
      reject(new Error(xhr.status === 403 ? 'EXPIRED_URL' : 'R2_UPLOAD_FAILED'))
    }
    xhr.onerror = () => reject(new Error('NETWORK'))
    xhr.send(blob)
  })
}

export function StoriesPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<AdminStory[]>([])
  const [error, setError] = useState<string | null>(null)
  const [photoDuration, setPhotoDuration] = useState(PHOTO_STORY_DEFAULT_SECONDS)
  const [expireMode, setExpireMode] = useState<StoryExpireMode>('event_day')
  const [customExpiresAt, setCustomExpiresAt] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [preview, setPreview] = useState<{ items: StoryItem[]; start: number } | null>(null)

  const load = async () => {
    const next = await api.listStories()
    setItems(next)
  }

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message))
  }, [])

  const photoCount = items.filter((s) => s.mediaType === 'photo').length
  const videoCount = items.filter((s) => s.mediaType === 'video').length
  const labels = useMemo(() => {
    let photos = 0
    let videos = 0
    return Object.fromEntries(
      items.map((story) => {
        if (story.mediaType === 'photo') {
          photos += 1
          return [story.id, `Photo ${photos}`]
        }
        videos += 1
        return [story.id, `Video ${videos}`]
      }),
    ) as Record<string, string>
  }, [items])

  const upload = async (fileList: FileList | null) => {
    if (!fileList?.length) return
    setUploading(true)
    setProgress(4)
    setError(null)
    try {
      for (const file of Array.from(fileList)) {
        const prepared = await prepareFile(file)
        if (!prepared) {
          setError('This file type is not supported for stories')
          continue
        }
        const mimeType = prepared.blob.type || file.type || (prepared.type === 'photo' ? 'image/jpeg' : 'video/mp4')
        const auth = await api.authorizeStory({
          mimeType,
          fileSize: prepared.blob.size,
          mediaType: prepared.type,
          hasThumb: Boolean(prepared.thumb),
          duration: prepared.type === 'photo' ? photoDuration : prepared.duration,
          expireMode,
          customExpiresAt: expireMode === 'custom' ? customExpiresAt || null : null,
          isActive: true,
        })
        await putBlob(auth.signedUploadUrl, prepared.blob, mimeType, setProgress)
        if (auth.signedThumbUrl && prepared.thumb) {
          await putBlob(auth.signedThumbUrl, prepared.thumb, 'image/jpeg')
        }
        await api.confirmStory({
          storyId: auth.storyId,
          objectKey: auth.objectKey,
          thumbnailObjectKey: auth.thumbnailObjectKey,
          fileSize: prepared.blob.size,
          mimeType,
          duration: prepared.type === 'photo' ? photoDuration : prepared.duration,
          activate: true,
        })
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not publish story')
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  const move = async (id: string, direction: -1 | 1) => {
    const ids = items.map((s) => s.id)
    const index = ids.indexOf(id)
    const next = index + direction
    if (index < 0 || next < 0 || next >= ids.length) return
    const copy = [...ids]
    const [row] = copy.splice(index, 1)
    copy.splice(next, 0, row!)
    await api.reorderStories(copy)
    await load()
  }

  const openPreview = (startId?: string) => {
    const ready = items.filter((s) => s.status === 'ready')
    if (!ready.length) {
      setError('No published stories to preview')
      return
    }
    setPreview({
      items: ready.map((s) => ({
        id: s.id,
        mediaType: s.mediaType,
        duration: s.duration,
        createdAt: s.createdAt,
      })),
      start: Math.max(0, ready.findIndex((s) => s.id === startId)),
    })
  }

  if (error && !items.length) return <p>{error}</p>

  return (
    <div>
      <div className="admin-top">
        <div>
          <Link to="/admin/memories" className="admin-muted">
            ← Memories
          </Link>
          <h1>Our Moment</h1>
          <p className="admin-muted">Couple-only stories. Guests can view, not publish.</p>
        </div>
      </div>

      {error ? <p className="admin-muted">{error}</p> : null}

      <section className="admin-card" style={{ padding: '1.1rem', marginBottom: '1.2rem' }}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          className="moments-hidden"
          style={{ display: 'none' }}
          onChange={(e) => {
            void upload(e.target.files)
            e.target.value = ''
          }}
        />
        <h2 style={{ marginTop: 0 }}>Publish a story</h2>
        <div className="admin-toolbar" style={{ marginTop: '0.8rem' }}>
          <label>
            Photo duration ({photoDuration}s)
            <input
              type="range"
              min={PHOTO_STORY_MIN_SECONDS}
              max={PHOTO_STORY_MAX_SECONDS}
              value={photoDuration}
              onChange={(e) => setPhotoDuration(Number(e.target.value))}
            />
          </label>
          <label>
            Expiration
            <select value={expireMode} onChange={(e) => setExpireMode(e.target.value as StoryExpireMode)}>
              <option value="event_day">Event day (default)</option>
              <option value="none">No expiration</option>
              <option value="custom">Custom date & time</option>
            </select>
          </label>
        </div>
        <p className="admin-muted">
          Photos show {PHOTO_STORY_MIN_SECONDS}–{PHOTO_STORY_MAX_SECONDS} seconds. Videos play up to {STORY_MAX_SECONDS}s.
        </p>
        {expireMode === 'custom' && (
          <input
            type="datetime-local"
            value={customExpiresAt}
            onChange={(e) => setCustomExpiresAt(e.target.value)}
          />
        )}
        <button
          className="admin-btn"
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          style={{ marginTop: '0.9rem' }}
        >
          {uploading ? `Uploading ${progress}%` : 'Upload photo or video'}
        </button>
      </section>

      <div className="admin-top">
        <h2>
          {items.length} stories · {photoCount} photos · {videoCount} videos
        </h2>
        <button className="admin-btn secondary" type="button" onClick={() => openPreview()}>
          Preview all
        </button>
      </div>

      <div className="admin-list">
        {items.map((story) => (
          <article key={story.id} className="admin-card" style={{ padding: '0.9rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.9rem' }}>
              <button
                type="button"
                onClick={() => openPreview(story.id)}
                style={{
                  width: 80,
                  height: 96,
                  border: 0,
                  padding: 0,
                  overflow: 'hidden',
                  borderRadius: 12,
                  background: '#eee8de',
                }}
              >
                {story.thumbUrl ? (
                  <img src={story.thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  '▶'
                )}
              </button>
              <div style={{ flex: 1 }}>
                <strong>{labels[story.id]}</strong>
                <p className="admin-muted">
                  {story.mediaType} · {story.duration}s · {formatBytes(story.fileSize)}
                </p>
                <p>
                  Views: {story.uniqueViewers}
                  <span className="admin-muted"> · {story.views} plays</span>
                </p>
                <p className="admin-muted">
                  {story.expiresAt ? `Expires ${new Date(story.expiresAt).toLocaleString()}` : 'No expiration'}
                </p>
                <p className="admin-muted">
                  {story.status === 'pending' ? 'pending' : story.isActive ? 'active' : 'inactive'}
                </p>
                <div className="admin-toolbar" style={{ marginTop: '0.55rem' }}>
                  <button className="admin-btn secondary" type="button" onClick={() => void move(story.id, -1)}>
                    Up
                  </button>
                  <button className="admin-btn secondary" type="button" onClick={() => void move(story.id, 1)}>
                    Down
                  </button>
                  <button className="admin-btn secondary" type="button" onClick={() => openPreview(story.id)}>
                    Preview
                  </button>
                  <button
                    className="admin-btn secondary"
                    type="button"
                    onClick={() => void api.updateStory(story.id, { isActive: !story.isActive }).then(load)}
                  >
                    {story.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  {story.mediaType === 'photo' && (
                    <select
                      value={Math.round(story.duration)}
                      onChange={(e) =>
                        void api.updateStory(story.id, { duration: Number(e.target.value) }).then(load)
                      }
                    >
                      {Array.from({ length: 6 }, (_, i) => i + PHOTO_STORY_MIN_SECONDS).map((n) => (
                        <option key={n} value={n}>
                          {n}s
                        </option>
                      ))}
                    </select>
                  )}
                  <select
                    defaultValue={story.expiresAt ? 'custom' : 'none'}
                    onChange={(e) => {
                      const mode = e.target.value as StoryExpireMode
                      if (mode === 'custom') return
                      void api.updateStory(story.id, { expireMode: mode }).then(load)
                    }}
                  >
                    <option value="event_day">Event day</option>
                    <option value="none">No expiration</option>
                  </select>
                  <button
                    className="admin-btn danger"
                    type="button"
                    onClick={() => {
                      if (!confirm('Delete this story? The media file will be removed.')) return
                      void api.deleteStory(story.id).then(load)
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
        {items.length === 0 && <p className="admin-muted">No stories yet. The guest monogram will stay in its normal state.</p>}
      </div>

      {preview && (
        <StoryViewer
          stories={preview.items}
          startIndex={preview.start}
          coupleLabel="Y · N"
          dir="ltr"
          getMedia={(storyId) => api.storySignedUrl(storyId)}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  )
}
