import { useCallback, useEffect, useRef, useState } from 'react'
import {
  cacheGuestName,
  cachedGuestName,
  clearDraftCaption,
  getDeviceToken,
  markLocalStoryViewed,
  readDraftCaption,
  readLocalStoryViews,
  resetDeviceToken,
  saveDraftCaption,
} from './guest-session'
import { prepareFileFast } from './media-utils'
import { memoriesApi, type GuestStoryFeed, type MemoryEvent, type MemoryGuestState } from './api'
import { VideoPoster } from './VideoPoster'
import { Pager, LazyThumb, slicePage, MINE_PAGE_SIZE, GALLERY_PAGE_SIZE } from './Pager'
import { createUploadQueue, requestGuestSignedUrl, type QueueItem } from './upload-client'
import { StoryRing } from './StoryRing'
import { StoryViewer } from './StoryViewer'
import { firstUnseenIndex, mergeViewedIds, ringState } from './story-core'
import {
  coupleParts,
  engagementHeadline,
  momentsDir,
  readMomentsLanguage,
  saveMomentsLanguage,
  type MomentsLang,
} from './couple-headline'
import {
  newClientMessageId,
  persistOutgoingMessage,
  resumeQueuedMessages,
  sendQueuedMessage,
} from './guest-message-outbox'
import { LeadPopup, MomentsLeadFooter } from './LeadPopup'
import {
  applyGuestDocumentLang,
  fillCopy,
  getGuestCopy,
  GUEST_LANGUAGE_OPTIONS,
  queueStatusLabel,
} from './guest-copy'
import './moments.css'

type Screen = 'landing' | 'upload' | 'success' | 'mine' | 'message' | 'messageSent'

function displayDate(iso: string) {
  const match = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) return `${match[3]}/${match[2]}/${match[1]}`
  return iso
}

function nameInitial(part: string) {
  if (/يزن|yazan|יזן/i.test(part)) return 'Y'
  if (/نورا|nora|נורה/i.test(part)) return 'N'
  const latin = part.match(/[A-Za-z]/)
  if (latin) return latin[0]!.toUpperCase()
  return part.charAt(0) || ''
}

function coupleInitials(names: string) {
  return coupleParts(names).map(nameInitial).filter(Boolean).slice(0, 2).join(' · ') || 'Y · N'
}

export function MomentsExperience({ table }: { table: string | null }) {
  const [token, setToken] = useState('')
  const [screen, setScreen] = useState<Screen>('landing')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<'upload' | 'message'>('upload')
  const [items, setItems] = useState<QueueItem[]>([])
  const [caption, setCaption] = useState('')
  const [messageText, setMessageText] = useState('')
  const [name, setName] = useState('')
  const [phoneLast4, setPhoneLast4] = useState('')
  const [busy, setBusy] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<{ url: string; type: string; loading?: boolean } | null>(null)
  const [confirm, setConfirm] = useState<null | { kind: 'delete'; mediaId: string } | { kind: 'switch' }>(null)
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null)
  const [event, setEvent] = useState<MemoryEvent | null>(null)
  const [guestState, setGuestState] = useState<MemoryGuestState | null>(null)
  const [storyFeed, setStoryFeed] = useState<GuestStoryFeed | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [lang, setLang] = useState<MomentsLang>(() => readMomentsLanguage() ?? 'ar')
  const [minePage, setMinePage] = useState(0)
  const [galleryPage, setGalleryPage] = useState(0)
  const [leadOpen, setLeadOpen] = useState(false)
  const cameraRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)
  const queueRef = useRef<ReturnType<typeof createUploadQueue> | null>(null)
  const finalized = useRef(new Set<string>())
  const copy = getGuestCopy(lang)
  const dir = momentsDir(lang)

  useEffect(() => {
    applyGuestDocumentLang(lang)
    return () => {
      document.documentElement.lang = 'ar'
      document.documentElement.dir = 'rtl'
    }
  }, [lang])

  const showToast = (text: string) => {
    setToast(text)
    window.setTimeout(() => setToast(null), 2200)
  }

  const refreshGuest = useCallback(async (deviceToken: string) => {
    const next = await memoriesApi.me(deviceToken)
    setGuestState(next)
    return next
  }, [])

  useEffect(() => {
    const deviceToken = getDeviceToken()
    setToken(deviceToken)
    setCaption(readDraftCaption())
    setName(cachedGuestName() ?? '')
    void memoriesApi.event().then(setEvent)
    void refreshGuest(deviceToken)
    void memoriesApi.stories(deviceToken).then(setStoryFeed).catch(() => setStoryFeed(null))
  }, [refreshGuest])

  useEffect(() => {
    const queue = createUploadQueue({
      deviceToken: () => token || getDeviceToken(),
      eventId: () => event?.id ?? '',
      table: () => table,
      onChange: setItems,
    })
    queueRef.current = queue
    void queue.restore()
    return () => queue.dispose()
  }, [event?.id, table, token])

  useEffect(() => {
    if (!token || !event?.id) return
    void resumeQueuedMessages((input) => memoriesApi.message(token, input.message)).then(() =>
      refreshGuest(token),
    )
  }, [token, event?.id, refreshGuest])

  useEffect(() => {
    const ready = items.filter(
      (item) => item.state === 'completed' && item.mediaId && !finalized.current.has(item.mediaId),
    )
    if (!ready.length || !token) return
    const mediaIds = ready.map((item) => item.mediaId!)
    for (const id of mediaIds) finalized.current.add(id)
    void memoriesApi.finalize(token, mediaIds, caption || null).then(() => refreshGuest(token))
  }, [items, token, caption, refreshGuest])

  const guest = guestState?.guest ?? null
  const stats = guestState?.stats ?? null
  const myMedia = guestState?.media ?? []
  const minePaged = slicePage(myMedia, minePage, MINE_PAGE_SIZE)
  const galleryPaged = slicePage(event?.gallery ?? [], galleryPage, GALLERY_PAGE_SIZE)
  const storyItems = storyFeed?.stories ?? []
  const viewedIds = mergeViewedIds(storyFeed?.viewedIds, readLocalStoryViews())
  const ring = ringState(
    storyItems.map((item) => item.id),
    viewedIds,
  )
  const coupleLabel = event ? coupleInitials(event.coupleNames) : 'Y · N'
  useEffect(() => {
    if (minePaged.page !== minePage) setMinePage(minePaged.page)
  }, [minePaged.page, minePage])

  useEffect(() => {
    if (galleryPaged.page !== galleryPage) setGalleryPage(galleryPaged.page)
  }, [galleryPaged.page, galleryPage])

  const openStories = () => {
    if (!storyItems.length) return
    setViewerOpen(true)
  }
  const markStorySeen = (storyId: string) => {
    markLocalStoryViewed(storyId)
    void memoriesApi
      .storyView(token || getDeviceToken(), storyId)
      .then(setStoryFeed)
      .catch(() => {
        setStoryFeed((prev) => {
          if (!prev) return prev
          const nextViewed = [...new Set([...prev.viewedIds, storyId])]
          return {
            ...prev,
            viewedIds: nextViewed,
            ring: ringState(
              prev.stories.map((item) => item.id),
              nextViewed,
            ),
            stories: prev.stories.map((item) =>
              item.id === storyId ? { ...item, viewed: true } : item,
            ),
          }
        })
      })
  }
  const storyViewer = viewerOpen && storyItems.length ? (
    <StoryViewer
      stories={storyItems}
      startIndex={firstUnseenIndex(
        storyItems.map((item) => item.id),
        viewedIds,
      )}
      coupleLabel={coupleLabel}
      dir={dir}
      locale={lang}
      closeLabel={copy.storyClose}
      muteLabel={copy.storyMute}
      unmuteLabel={copy.storyUnmute}
      getMedia={(storyId) => memoriesApi.storySignedUrl(token || getDeviceToken(), storyId)}
      onViewed={markStorySeen}
      onClose={() => setViewerOpen(false)}
    />
  ) : null
  const brand = (
    <header className="moments-brand">
      <label className="moments-lang">
        <span className="moments-hidden">{copy.language}</span>
        <select
          value={lang}
          aria-label={copy.language}
          onChange={(event) => {
            const next = event.target.value as MomentsLang
            setLang(next)
            saveMomentsLanguage(next)
          }}
        >
          {GUEST_LANGUAGE_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <StoryRing state={ring} label={ring === 'none' ? undefined : copy.storyMoment} onOpen={openStories}>
        <div className="moments-mono">
          <span dir="ltr">{coupleLabel}</span>
        </div>
      </StoryRing>
      <div className="moments-line" />
      <p className="moments-engagement" lang={lang} dir={momentsDir(lang)}>
        {engagementHeadline(event?.coupleNames ?? '', lang)}
      </p>
      {event?.eventDate ? (
        <p className="moments-gold" dir="ltr">
          {displayDate(event.eventDate)}
        </p>
      ) : null}
    </header>
  )

  const startFlow = (action: 'upload' | 'message') => {
    setPendingAction(action)
    if (!guest) {
      setSheetOpen(true)
      return
    }
    setScreen(action === 'message' ? 'message' : 'upload')
  }

  const identify = async () => {
    if (!name.trim()) return
    setBusy(true)
    try {
      const res = await memoriesApi.identify(token, name.trim(), table, phoneLast4.trim() || null)
      cacheGuestName(res.displayName)
      setSheetOpen(false)
      await refreshGuest(token)
      setScreen(pendingAction === 'message' ? 'message' : 'upload')
    } catch {
      showToast(copy.saveNameFailed)
    } finally {
      setBusy(false)
    }
  }

  const addFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList?.length) return
    const incoming = Array.from(fileList)
    setCompressing(true)
    const prepared = await Promise.all(incoming.map((file) => prepareFileFast(file)))
    const valid = prepared.filter(Boolean)
    if (valid.length < incoming.length) showToast(copy.someFilesUnsupported)
    queueRef.current?.add(
      valid.map((item) => ({
        clientUploadId: item!.id,
        file: item!.blob,
        thumb: item!.thumb,
        previewUrl: item!.previewUrl,
        originalFilename: item!.file.name || `${item!.type}.${item!.type === 'photo' ? 'jpg' : 'mp4'}`,
        mimeType: item!.blob.type || item!.file.type || (item!.type === 'photo' ? 'image/jpeg' : 'video/mp4'),
        mediaType: item!.type,
        width: item!.width,
        height: item!.height,
        duration: item!.duration,
      })),
    )
    setCompressing(false)
  }, [copy])

  const openMedia = async (mediaId: string, type: string, fallbackUrl?: string | null) => {
    setLightbox({ url: fallbackUrl ?? '', type, loading: true })
    try {
      const signed = await requestGuestSignedUrl(token, mediaId)
      setLightbox({ url: signed.url, type, loading: false })
    } catch {
      if (fallbackUrl) setLightbox({ url: fallbackUrl, type, loading: false })
      else {
        setLightbox(null)
        showToast(copy.openFileFailed)
      }
    }
  }

  const submitMemory = () => {
    const queue = queueRef.current
    if (!queue) return
    const pending = queue.getItems()
    if (!pending.length && !items.length) {
      showToast(copy.chooseFileFirst)
      return
    }
    saveDraftCaption(caption)
    queue.start()
    clearDraftCaption()
    setScreen('success')
  }

  const sendMessage = () => {
    const message = messageText.trim()
    if (!message || !event) return
    const clientMessageId = newClientMessageId()
    setMessageText('')
    setScreen('messageSent')
    void persistOutgoingMessage({ clientMessageId, eventId: event.id, message }).then((row) =>
      sendQueuedMessage(row, (input) => memoriesApi.message(token, input.message)).then(() =>
        refreshGuest(token),
      ),
    )
  }

  if (!event) {
    return (
      <div className="moments-root" dir={dir} lang={lang}>
        <div className="moments-wrap" style={{ textAlign: 'center' }}>
          {copy.preparing}
          <MomentsLeadFooter copy={copy} onOpen={() => setLeadOpen(true)} />
        </div>
        <LeadPopup open={leadOpen} copy={copy} lang={lang} dir={dir} onClose={() => setLeadOpen(false)} />
      </div>
    )
  }

  if (!event.uploadsOpen) {
    return (
      <div className="moments-root" dir={dir} lang={lang}>
        <div className="moments-wrap" style={{ textAlign: 'center' }}>
          {brand}
          <h1>{copy.closedTitle}</h1>
          {galleryPaged.slice.length > 0 && (
            <>
              <div className="moments-grid two" style={{ marginTop: '2rem' }}>
                {galleryPaged.slice.map((item) => (
                  <button
                    key={item.id}
                    className="moments-thumb tall"
                    type="button"
                    onClick={() => setLightbox({ url: item.url, type: item.type })}
                  >
                    {item.type === 'video' ? (
                      <div className="moments-video-placeholder" />
                    ) : (
                      <LazyThumb src={item.url} />
                    )}
                    {item.type === 'video' && <span className="moments-video-badge">{copy.video}</span>}
                  </button>
                ))}
              </div>
              <Pager
                page={galleryPaged.page}
                pages={galleryPaged.pages}
                copy={copy}
                onPage={(next) => {
                  setGalleryPage(next)
                  window.scrollTo({ top: 0, behavior: 'auto' })
                }}
              />
            </>
          )}
          <MomentsLeadFooter copy={copy} onOpen={() => setLeadOpen(true)} />
        </div>
        {lightbox && <Lightbox copy={copy} {...lightbox} onClose={() => setLightbox(null)} />}
        {storyViewer}
        <LeadPopup open={leadOpen} copy={copy} lang={lang} dir={dir} onClose={() => setLeadOpen(false)} />
      </div>
    )
  }

  return (
    <div className="moments-root" dir={dir} lang={lang}>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        className="moments-hidden"
        onChange={(e) => {
          void addFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="moments-hidden"
        onChange={(e) => {
          void addFiles(e.target.files)
          e.target.value = ''
        }}
      />

      <div className="moments-wrap">
        {brand}

        {screen === 'landing' && (
          <section style={{ textAlign: 'center' }}>
            {guest ? (
              <>
                <h1>{fillCopy(copy.welcomeBack, { name: guest.displayName })}</h1>
                <p className="moments-muted">{copy.readyAnother}</p>
                <div className="moments-not-me">
                  <button className="moments-link" type="button" onClick={() => setConfirm({ kind: 'switch' })}>
                    {copy.notMe}
                  </button>
                </div>
                {stats && (
                  <div className="moments-stats">
                    <div className="moments-card">
                      <strong>{stats.photos}</strong>
                      <span className="moments-muted">{copy.photo}</span>
                    </div>
                    <div className="moments-card">
                      <strong>{stats.videos}</strong>
                      <span className="moments-muted">{copy.video}</span>
                    </div>
                    <div className="moments-card">
                      <strong>{stats.messages}</strong>
                      <span className="moments-muted">{copy.message}</span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <h1>{copy.shareTitle}</h1>
                <p className="moments-muted">{copy.welcomeLine1}</p>
                <p className="moments-muted" style={{ marginTop: '0.55rem' }}>
                  {copy.welcomeLine2}
                </p>
              </>
            )}
            <div style={{ marginTop: '2rem', display: 'grid', gap: '0.75rem' }}>
              <button className="moments-btn" type="button" onClick={() => startFlow('upload')}>
                {guest ? copy.addMoment : copy.shareMoment}
              </button>
              <button className="moments-btn-quiet" type="button" onClick={() => startFlow('message')}>
                {copy.sendCoupleMessage}
              </button>
              {guest && (
                <button className="moments-link" type="button" onClick={() => { setMinePage(0); setScreen('mine') }}>
                  {copy.viewMine}
                </button>
              )}
            </div>
          </section>
        )}

        {screen === 'upload' && (
          <section>
            <h2>{fillCopy(copy.helloName, { name: guest?.displayName ?? '' })}</h2>
            <p className="moments-muted">{copy.uploadPrompt}</p>
            <div className="moments-card" style={{ marginTop: '1.25rem' }}>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <button className="moments-btn" type="button" onClick={() => cameraRef.current?.click()}>
                  {copy.takePhotoVideo}
                </button>
                <button className="moments-btn-quiet" type="button" onClick={() => libraryRef.current?.click()}>
                  {copy.chooseFromPhone}
                </button>
              </div>
              {items.length > 0 && (
                <div className="moments-grid">
                  {items.map((item) => {
                    const active = !['completed', 'queued', 'failed'].includes(item.state)
                    return (
                      <div key={item.clientUploadId} className="moments-thumb">
                        {item.mediaType === 'video' ? (
                          <VideoPoster
                            src={item.thumb ? null : item.previewUrl}
                            poster={item.thumb ? item.previewUrl : null}
                          />
                        ) : item.previewUrl ? (
                          <img src={item.previewUrl} alt="" />
                        ) : (
                          <div className="moments-video-placeholder">
                            <div className="moments-spinner" />
                          </div>
                        )}
                        {item.mediaType === 'video' && <span className="moments-video-badge">{copy.video}</span>}
                        <span className="moments-status">{queueStatusLabel(copy, item)}</span>
                        {active && (
                          <div className="moments-load-overlay" aria-hidden>
                            <div className="moments-spinner" />
                          </div>
                        )}
                        {item.state !== 'completed' && item.state !== 'queued' && (
                          <div className={`moments-progress${item.mediaType === 'video' ? ' thick' : ''}`}>
                            <span style={{ width: `${Math.max(item.progress, item.state === 'authorizing' ? 8 : 0)}%` }} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              <textarea
                className="moments-area"
                style={{ marginTop: '1.1rem' }}
                rows={3}
                maxLength={600}
                value={caption}
                placeholder={copy.captionPlaceholder}
                onChange={(e) => {
                  setCaption(e.target.value)
                  saveDraftCaption(e.target.value)
                }}
              />
              <button className="moments-btn" style={{ marginTop: '1rem' }} disabled={compressing} onClick={() => void submitMemory()}>
                {copy.sendMemory}
              </button>
              {items.some((item) => item.state === 'failed') && (
                <button
                  className="moments-link"
                  type="button"
                  onClick={() => {
                    queueRef.current?.retryFailed()
                    void submitMemory()
                  }}
                >
                  {copy.retry}
                </button>
              )}
            </div>
            <button className="moments-link" type="button" onClick={() => setScreen('landing')}>
              {copy.backHome}
            </button>
          </section>
        )}

        {screen === 'success' && (
          <section style={{ textAlign: 'center' }}>
            <h2>{copy.memoryArrived}</h2>
            <p className="moments-muted">{copy.thanksForMoment}</p>
            <div style={{ marginTop: '2rem', display: 'grid', gap: '0.75rem' }}>
              <button className="moments-btn" type="button" onClick={() => setScreen('upload')}>
                {copy.addAnotherMemory}
              </button>
              <button className="moments-btn-quiet" type="button" onClick={() => setScreen('message')}>
                {copy.writeMessage}
              </button>
                <button className="moments-link" type="button" onClick={() => { setMinePage(0); setScreen('mine') }}>
                  {copy.viewMine}
                </button>
            </div>
          </section>
        )}

        {screen === 'mine' && (
          <section>
            <h2>{copy.myShares}</h2>
            <p className="moments-muted moments-stats-line">
              {stats ? fillCopy(copy.statsLine, { photos: stats.photos, videos: stats.videos, messages: stats.messages }) : ''}
            </p>
            {myMedia.length === 0 ? (
              <p className="moments-muted" style={{ textAlign: 'center', marginTop: '2rem' }}>
                {copy.noMemoriesYet}
              </p>
            ) : (
              <>
              <div className="moments-mine-list">
                {minePaged.slice.map((item) => (
                  <article key={item.id} className="moments-card moments-mine-card">
                    <button className="moments-thumb tall" type="button" onClick={() => void openMedia(item.id, item.type, item.thumbUrl ?? item.url)}>
                      {item.type === 'video' ? (
                        item.thumbUrl ? <LazyThumb src={item.thumbUrl} /> : <div className="moments-video-placeholder" />
                      ) : (
                        <LazyThumb src={item.thumbUrl ?? item.url} />
                      )}
                      {item.type === 'video' && <span className="moments-video-badge">{copy.video}</span>}
                    </button>
                    <p className="moments-hint">{copy.storyTapToView}</p>
                    {item.caption && editingCaptionId !== item.id ? (
                      <p className="moments-caption-text">{item.caption}</p>
                    ) : null}
                    {editingCaptionId === item.id ? (
                      <>
                        <label className="moments-label" htmlFor={`caption-${item.id}`}>
                          {copy.captionOnMemory}
                        </label>
                        <textarea
                          id={`caption-${item.id}`}
                          className="moments-area"
                          rows={3}
                          maxLength={600}
                          defaultValue={item.caption ?? ''}
                          placeholder={copy.captionEditPlaceholder}
                          autoFocus
                          onBlur={(e) => {
                            const next = e.target.value.trim()
                            setEditingCaptionId(null)
                            if (next === (item.caption ?? '')) return
                            void memoriesApi.caption(token, item.id, next).then(() => refreshGuest(token))
                          }}
                        />
                      </>
                    ) : (
                      <button className="moments-btn-quiet moments-btn-small" type="button" onClick={() => setEditingCaptionId(item.id)}>
                        {item.caption ? copy.editCaption : copy.addCaption}
                      </button>
                    )}
                    <button className="moments-delete" type="button" onClick={() => setConfirm({ kind: 'delete', mediaId: item.id })}>
                      {copy.deleteThisMemory}
                    </button>
                  </article>
                ))}
              </div>
              <Pager
                page={minePaged.page}
                pages={minePaged.pages}
                copy={copy}
                onPage={(next) => {
                  setEditingCaptionId(null)
                  setMinePage(next)
                  window.scrollTo({ top: 0, behavior: 'auto' })
                }}
              />
              </>
            )}
            <button className="moments-btn" style={{ marginTop: '1.4rem' }} type="button" onClick={() => setScreen('upload')}>
              {copy.addMoment}
            </button>
            <button className="moments-link" type="button" onClick={() => setScreen('landing')}>
              {copy.backHome}
            </button>
          </section>
        )}

        {screen === 'message' && (
          <section>
            <h2>{copy.leaveWord}</h2>
            <p className="moments-muted">{guest ? fillCopy(copy.onBehalfOf, { name: guest.displayName }) : ''}</p>
            <textarea
              className="moments-area moments-card"
              style={{ marginTop: '1.2rem' }}
              rows={7}
              maxLength={1000}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder={copy.captionPlaceholder}
            />
            <button className="moments-btn" style={{ marginTop: '1rem' }} disabled={!messageText.trim()} onClick={() => void sendMessage()}>
              {copy.sendMessage}
            </button>
            <button className="moments-link" type="button" onClick={() => setScreen('landing')}>
              {copy.backHome}
            </button>
          </section>
        )}

        {screen === 'messageSent' && (
          <section style={{ textAlign: 'center' }}>
            <h2>{copy.messageArrived}</h2>
            <p className="moments-muted">{copy.sendMoreAnytime}</p>
            <div style={{ marginTop: '2rem', display: 'grid', gap: '0.75rem' }}>
              <button className="moments-btn" type="button" onClick={() => setScreen('upload')}>
                {copy.sharePhotoOrVideo}
              </button>
              <button className="moments-btn-quiet" type="button" onClick={() => setScreen('message')}>
                {copy.writeAnotherMessage}
              </button>
            </div>
          </section>
        )}
        <MomentsLeadFooter copy={copy} onOpen={() => setLeadOpen(true)} />
      </div>

      {sheetOpen && (
        <>
          <button className="moments-overlay" type="button" aria-label={copy.close} onClick={() => setSheetOpen(false)} />
          <div className="moments-sheet" dir={dir}>
            <h3>{copy.identifyTitle}</h3>
            <p className="moments-muted">{copy.identifyBody}</p>
            <label style={{ display: 'block', marginTop: '1.1rem' }}>{copy.yourName}</label>
            <input className="moments-field" value={name} maxLength={60} autoFocus onChange={(e) => setName(e.target.value)} />
            <label style={{ display: 'block', marginTop: '0.9rem' }}>
              {copy.lastFour} <span className="moments-muted">{copy.optional}</span>
            </label>
            <input
              className="moments-field"
              value={phoneLast4}
              maxLength={4}
              inputMode="numeric"
              autoComplete="off"
              dir="ltr"
              onChange={(e) => setPhoneLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
            <button className="moments-btn" style={{ marginTop: '1.1rem' }} disabled={busy || !name.trim()} onClick={() => void identify()}>
              {copy.start}
            </button>
            <p className="moments-muted" style={{ textAlign: 'center', marginTop: '0.9rem', fontSize: '0.8rem' }}>
              {copy.namePrivacy}
            </p>
          </div>
        </>
      )}

      {confirm && (
        <ConfirmSheet
          dir={dir}
          copy={copy}
          title={confirm.kind === 'delete' ? copy.confirmDeleteTitle : copy.confirmSwitchTitle}
          body={
            confirm.kind === 'delete'
              ? copy.confirmDeleteBody
              : fillCopy(copy.confirmSwitchBody, { name: guest?.displayName ?? copy.guestFallback })
          }
          confirmLabel={confirm.kind === 'delete' ? copy.confirmDelete : copy.confirmNotMe}
          busy={busy}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            if (confirm.kind === 'delete') {
              setBusy(true)
              try {
                await memoriesApi.remove(token, confirm.mediaId)
                await refreshGuest(token)
                setConfirm(null)
                showToast(copy.deleted)
              } catch {
                showToast(copy.deleteFailed)
              } finally {
                setBusy(false)
              }
              return
            }
            resetDeviceToken()
            const next = getDeviceToken()
            setToken(next)
            setGuestState(null)
            setConfirm(null)
            setScreen('landing')
            void refreshGuest(next)
          }}
        />
      )}
      {lightbox && <Lightbox copy={copy} {...lightbox} onClose={() => setLightbox(null)} />}
      {storyViewer}
      {toast && <div className="moments-toast">{toast}</div>}
      <LeadPopup open={leadOpen} copy={copy} lang={lang} dir={dir} onClose={() => setLeadOpen(false)} />
    </div>
  )
}

function ConfirmSheet({
  title,
  body,
  confirmLabel,
  busy,
  copy,
  dir,
  onClose,
  onConfirm,
}: {
  title: string
  body: string
  confirmLabel: string
  busy: boolean
  copy: { close: string; cancel: string }
  dir: 'rtl' | 'ltr'
  onClose: () => void
  onConfirm: () => void | Promise<void>
}) {
  return (
    <>
      <button className="moments-overlay" type="button" aria-label={copy.close} onClick={onClose} />
      <div className="moments-sheet" dir={dir}>
        <h3>{title}</h3>
        <p className="moments-muted" style={{ marginTop: '0.6rem' }}>
          {body}
        </p>
        <div className="moments-confirm-actions">
          <button className="moments-btn" type="button" disabled={busy} onClick={() => void onConfirm()}>
            {confirmLabel}
          </button>
          <button className="moments-btn-quiet" type="button" disabled={busy} onClick={onClose}>
            {copy.cancel}
          </button>
        </div>
      </div>
    </>
  )
}

function Lightbox({
  url,
  type,
  loading,
  copy,
  onClose,
}: {
  url: string
  type: string
  loading?: boolean
  copy: { close: string; loadingVideo: string; loading: string }
  onClose: () => void
}) {
  const [buffering, setBuffering] = useState(type === 'video')
  const showLoader = Boolean(loading) || (type === 'video' && buffering)

  return (
    <div className="moments-lightbox">
      <button type="button" onClick={onClose} style={{ position: 'absolute', top: '1rem', insetInlineEnd: '1rem', color: '#fff' }}>
        {copy.close}
      </button>
      <div className="moments-lightbox-stage">
        {type === 'video' ? (
          url ? (
            <video
              src={url}
              controls
              playsInline
              autoPlay
              onLoadStart={() => setBuffering(true)}
              onWaiting={() => setBuffering(true)}
              onCanPlay={() => setBuffering(false)}
              onPlaying={() => setBuffering(false)}
            />
          ) : null
        ) : url ? (
          <img src={url} alt="" onLoad={() => setBuffering(false)} />
        ) : null}
        {showLoader && (
          <div className="moments-lightbox-load">
            <div className="moments-spinner lg" />
            <span>{type === 'video' ? copy.loadingVideo : copy.loading}</span>
          </div>
        )}
      </div>
    </div>
  )
}
