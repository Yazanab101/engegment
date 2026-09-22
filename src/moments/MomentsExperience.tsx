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
import { prepareFile } from './media-utils'
import { memoriesApi, type GuestStoryFeed, type MemoryEvent, type MemoryGuestState } from './api'
import { VideoPoster } from './VideoPoster'
import { createUploadQueue, queueStatusLabel, requestGuestSignedUrl, type QueueItem } from './upload-client'
import { StoryRing } from './StoryRing'
import { StoryViewer } from './StoryViewer'
import { firstUnseenIndex, mergeViewedIds, ringState } from './story-core'
import './moments.css'

type Screen = 'landing' | 'upload' | 'success' | 'mine' | 'message' | 'messageSent'

function displayDate(iso: string) {
  const match = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) return `${match[3]}/${match[2]}/${match[1]}`
  return iso
}

function coupleParts(names: string) {
  const parts = names
    .split(/\s*(?:&|و)\s*/g)
    .map((part) => part.trim())
    .filter(Boolean)
  const yazan = parts.find((part) => /يزن|yazan/i.test(part))
  const nora = parts.find((part) => /نورا|nora/i.test(part))
  if (yazan && nora) return [yazan, nora]
  return parts.slice(0, 2)
}

function nameInitial(part: string) {
  if (/يزن|yazan/i.test(part)) return 'Y'
  if (/نورا|nora/i.test(part)) return 'N'
  const latin = part.match(/[A-Za-z]/)
  if (latin) return latin[0]!.toUpperCase()
  return part.charAt(0) || ''
}

function coupleInitials(names: string) {
  return coupleParts(names).map(nameInitial).filter(Boolean).slice(0, 2).join(' · ') || 'Y · N'
}

function engagementHeadline(names: string) {
  const parts = coupleParts(names).map((part) => {
    if (/يزن|yazan/i.test(part)) return 'يزن'
    if (/نورا|nora/i.test(part)) return 'نورا'
    return part
  })
  if (parts.length >= 2) return `خطوبة ${parts[0]} & ${parts[1]}`
  return names.trim() ? `خطوبة ${names.trim()}` : 'خطوبة يزن & نورا'
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
  const cameraRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)
  const queueRef = useRef<ReturnType<typeof createUploadQueue> | null>(null)

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
    return () => queue.dispose()
  }, [event?.id, table, token])

  const guest = guestState?.guest ?? null
  const stats = guestState?.stats ?? null
  const myMedia = guestState?.media ?? []
  const storyItems = storyFeed?.stories ?? []
  const viewedIds = mergeViewedIds(storyFeed?.viewedIds, readLocalStoryViews())
  const ring = ringState(
    storyItems.map((item) => item.id),
    viewedIds,
  )
  const coupleLabel = event ? coupleInitials(event.coupleNames) : 'Y · N'
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
      getMedia={(storyId) => memoriesApi.storySignedUrl(token || getDeviceToken(), storyId)}
      onViewed={markStorySeen}
      onClose={() => setViewerOpen(false)}
    />
  ) : null
  const brand = (
    <header className="moments-brand">
      <StoryRing state={ring} label={ring === 'none' ? undefined : 'لحظتنا الآن'} onOpen={openStories}>
        <div className="moments-mono">
          <span dir="ltr">{coupleLabel}</span>
        </div>
      </StoryRing>
      <div className="moments-line" />
      <p className="moments-engagement">{engagementHeadline(event?.coupleNames ?? '')}</p>
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
      const res = await memoriesApi.identify(token, name.trim(), table)
      cacheGuestName(res.displayName)
      setSheetOpen(false)
      await refreshGuest(token)
      setScreen(pendingAction === 'message' ? 'message' : 'upload')
    } catch {
      showToast('لم نتمكن من حفظ اسمك، حاول مرة أخرى')
    } finally {
      setBusy(false)
    }
  }

  const addFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList?.length) return
    const incoming = Array.from(fileList)
    setCompressing(true)
    showToast(incoming.some((file) => file.type.startsWith('video/')) ? 'جاري تجهيز الفيديو...' : 'جاري تجهيز الصورة...')
    const prepared = await Promise.all(incoming.map((file) => prepareFile(file)))
    const valid = prepared.filter(Boolean)
    if (valid.length < incoming.length) showToast('بعض الملفات غير مدعومة أو أكبر من المسموح')
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
  }, [])

  const openMedia = async (mediaId: string, type: string, fallbackUrl?: string | null) => {
    setLightbox({ url: fallbackUrl ?? '', type, loading: true })
    try {
      const signed = await requestGuestSignedUrl(token, mediaId)
      setLightbox({ url: signed.url, type, loading: false })
    } catch {
      if (fallbackUrl) setLightbox({ url: fallbackUrl, type, loading: false })
      else {
        setLightbox(null)
        showToast('تعذّر فتح الملف')
      }
    }
  }

  const submitMemory = async () => {
    const queue = queueRef.current
    if (!queue) return
    const pending = queue.getItems().filter((item) => item.state !== 'completed')
    if (!pending.length && !items.length) {
      showToast('اختر صورة أو فيديو أولًا')
      return
    }
    if (busy) return
    setBusy(true)
    saveDraftCaption(caption)
    try {
      queue.start()
      await queue.whenIdle()
      const snapshot = queue.getItems()
      const ok = snapshot.filter((item) => item.state === 'completed' && item.mediaId).map((item) => item.mediaId!)
      const failed = snapshot.filter((item) => item.state === 'failed')
      if (ok.length) await memoriesApi.finalize(token, ok, caption || null)
      await refreshGuest(token)
      if (failed.length) showToast('بعض الملفات لم تُرسل، جرّب مرة أخرى')
      else if (ok.length) {
        queue.clearCompleted()
        setCaption('')
        clearDraftCaption()
        setScreen('success')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      showToast(
        message.includes('RATE_LIMITED')
          ? 'أرسلت الكثير خلال وقت قصير، انتظر قليلًا 🤍'
          : message.includes('UPLOADS_CLOSED')
            ? 'انتهى وقت إضافة الذكريات'
            : 'تعذّر الإرسال، تأكد من الاتصال وحاول مجددًا',
      )
    } finally {
      setBusy(false)
    }
  }

  const sendMessage = async () => {
    if (!messageText.trim()) return
    setBusy(true)
    try {
      await memoriesApi.message(token, messageText)
      setMessageText('')
      await refreshGuest(token)
      setScreen('messageSent')
    } catch {
      showToast('لم تصل الرسالة، حاول مرة أخرى')
    } finally {
      setBusy(false)
    }
  }

  if (!event) {
    return (
      <div className="moments-root">
        <div className="moments-wrap" style={{ textAlign: 'center' }}>
          جاري التحضير…
        </div>
      </div>
    )
  }

  if (!event.uploadsOpen) {
    return (
      <div className="moments-root" dir="rtl">
        <div className="moments-wrap" style={{ textAlign: 'center' }}>
          {brand}
          <h1>شكرًا لأنكم كنتم جزءًا من فرحتنا 🤍</h1>
          {event.gallery.length > 0 && (
            <div className="moments-grid two" style={{ marginTop: '2rem' }}>
              {event.gallery.map((item) => (
                <button key={item.id} className="moments-thumb tall" onClick={() => setLightbox({ url: item.url, type: item.type })}>
                  {item.type === 'video' ? <VideoPoster src={item.url} /> : <img src={item.url} alt="" />}
                </button>
              ))}
            </div>
          )}
        </div>
        {lightbox && <Lightbox {...lightbox} onClose={() => setLightbox(null)} />}
        {storyViewer}
      </div>
    )
  }

  return (
    <div className="moments-root" dir="rtl">
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
                <h1>أهلًا من جديد، {guest.displayName} 🤍</h1>
                <p className="moments-muted">جاهز تضيف لحظة ثانية؟</p>
                {stats && (
                  <div className="moments-stats">
                    <div className="moments-card">
                      <strong>{stats.photos}</strong>
                      <span className="moments-muted">صورة</span>
                    </div>
                    <div className="moments-card">
                      <strong>{stats.videos}</strong>
                      <span className="moments-muted">فيديو</span>
                    </div>
                    <div className="moments-card">
                      <strong>{stats.messages}</strong>
                      <span className="moments-muted">رسالة</span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <h1>شاركونا لحظاتكم 🤍</h1>
                <p className="moments-muted">ساعدونا أن نرى هذه الليلة الجميلة من عيونكم</p>
                <p className="moments-muted" style={{ marginTop: '0.55rem' }}>
                  كل صورة، فيديو أو كلمة منكم ستبقى ذكرى جميلة معنا.
                </p>
              </>
            )}
            <div style={{ marginTop: '2rem', display: 'grid', gap: '0.75rem' }}>
              <button className="moments-btn" type="button" onClick={() => startFlow('upload')}>
                {guest ? 'أضف لحظة جديدة' : 'شارك لحظتك'}
              </button>
              <button className="moments-btn-quiet" type="button" onClick={() => startFlow('message')}>
                أرسل رسالة للعروسين
              </button>
              {guest && (
                <button className="moments-link" type="button" onClick={() => setScreen('mine')}>
                  عرض مشاركاتي
                </button>
              )}
            </div>
            {guest && (
              <button className="moments-link" type="button" onClick={() => setConfirm({ kind: 'switch' })}>
                هذا ليس أنا
              </button>
            )}
          </section>
        )}

        {screen === 'upload' && (
          <section>
            <h2>أهلًا {guest?.displayName ?? ''} 🤍</h2>
            <p className="moments-muted">شو اللحظة اللي حابب تشاركنا إياها؟</p>
            <div className="moments-card" style={{ marginTop: '1.25rem' }}>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <button className="moments-btn" type="button" onClick={() => cameraRef.current?.click()}>
                  التقط صورة أو فيديو
                </button>
                <button className="moments-btn-quiet" type="button" onClick={() => libraryRef.current?.click()}>
                  اختر من الهاتف
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
                        {item.mediaType === 'video' && <span className="moments-video-badge">فيديو</span>}
                        <span className="moments-status">{queueStatusLabel(item)}</span>
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
                placeholder="كلمة صغيرة من القلب 🤍"
                onChange={(e) => {
                  setCaption(e.target.value)
                  saveDraftCaption(e.target.value)
                }}
              />
              <button className="moments-btn" style={{ marginTop: '1rem' }} disabled={busy || compressing} onClick={() => void submitMemory()}>
                إرسال الذكرى
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
                  إعادة المحاولة
                </button>
              )}
            </div>
            <button className="moments-link" type="button" onClick={() => setScreen('landing')}>
              العودة للصفحة الرئيسية
            </button>
          </section>
        )}

        {screen === 'success' && (
          <section style={{ textAlign: 'center' }}>
            <h2>وصلتنا ذكراك 🤍</h2>
            <p className="moments-muted">شكرًا لأنك شاركتنا لحظة من هذه الليلة</p>
            <div style={{ marginTop: '2rem', display: 'grid', gap: '0.75rem' }}>
              <button className="moments-btn" type="button" onClick={() => setScreen('upload')}>
                أضف ذكرى أخرى
              </button>
              <button className="moments-btn-quiet" type="button" onClick={() => setScreen('message')}>
                اكتب رسالة
              </button>
              <button className="moments-link" type="button" onClick={() => setScreen('mine')}>
                عرض مشاركاتي
              </button>
            </div>
          </section>
        )}

        {screen === 'mine' && (
          <section>
            <h2>ذكرياتي اللي شاركتها</h2>
            <p className="moments-muted moments-stats-line">
              {stats ? `${stats.photos} صورة  ·  ${stats.videos} فيديو  ·  ${stats.messages} رسالة` : ''}
            </p>
            {myMedia.length === 0 ? (
              <p className="moments-muted" style={{ textAlign: 'center', marginTop: '2rem' }}>
                لم تشارك أي ذكرى بعد 🤍
              </p>
            ) : (
              <div className="moments-mine-list">
                {myMedia.map((item) => (
                  <article key={item.id} className="moments-card moments-mine-card">
                    <button className="moments-thumb tall" type="button" onClick={() => void openMedia(item.id, item.type, item.url)}>
                      {item.type === 'video' ? (
                        <VideoPoster
                          src={item.url}
                          poster={item.thumbUrl}
                          captureSrc={token ? `/api/media/file/${item.id}?token=${encodeURIComponent(token)}` : null}
                          onFrame={
                            item.thumbUrl
                              ? undefined
                              : (dataUrl) => {
                                  void memoriesApi.saveThumb(token, item.id, dataUrl)
                                }
                          }
                        />
                      ) : item.thumbUrl ? (
                        <img src={item.thumbUrl} alt="" />
                      ) : (
                        <div className="moments-video-placeholder" />
                      )}
                      {item.type === 'video' && <span className="moments-video-badge">فيديو</span>}
                    </button>
                    <p className="moments-hint">اضغط الصورة أو الفيديو للمشاهدة</p>
                    {item.caption && editingCaptionId !== item.id ? (
                      <p className="moments-caption-text">{item.caption}</p>
                    ) : null}
                    {editingCaptionId === item.id ? (
                      <>
                        <label className="moments-label" htmlFor={`caption-${item.id}`}>
                          كلمة على هذه الذكرى
                        </label>
                        <textarea
                          id={`caption-${item.id}`}
                          className="moments-area"
                          rows={3}
                          maxLength={600}
                          defaultValue={item.caption ?? ''}
                          placeholder="اختياري — اكتب كلمة صغيرة من القلب"
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
                        {item.caption ? 'عدّل الكلمة' : 'أضف كلمة على هذه الذكرى'}
                      </button>
                    )}
                    <button className="moments-delete" type="button" onClick={() => setConfirm({ kind: 'delete', mediaId: item.id })}>
                      حذف هذه الذكرى
                    </button>
                  </article>
                ))}
              </div>
            )}
            <button className="moments-btn" style={{ marginTop: '1.4rem' }} type="button" onClick={() => setScreen('upload')}>
              أضف لحظة جديدة
            </button>
            <button className="moments-link" type="button" onClick={() => setScreen('landing')}>
              العودة للصفحة الرئيسية
            </button>
          </section>
        )}

        {screen === 'message' && (
          <section>
            <h2>اترك كلمة من القلب 🤍</h2>
            <p className="moments-muted">{guest ? `باسم ${guest.displayName}` : ''}</p>
            <textarea
              className="moments-area moments-card"
              style={{ marginTop: '1.2rem' }}
              rows={7}
              maxLength={1000}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="كلمة صغيرة من القلب 🤍"
            />
            <button className="moments-btn" style={{ marginTop: '1rem' }} disabled={busy || !messageText.trim()} onClick={() => void sendMessage()}>
              إرسال الرسالة
            </button>
            <button className="moments-link" type="button" onClick={() => setScreen('landing')}>
              العودة للصفحة الرئيسية
            </button>
          </section>
        )}

        {screen === 'messageSent' && (
          <section style={{ textAlign: 'center' }}>
            <h2>وصلت رسالتك للعروسين 🤍</h2>
            <p className="moments-muted">يمكنك إرسال المزيد في أي وقت خلال الحفل</p>
            <div style={{ marginTop: '2rem', display: 'grid', gap: '0.75rem' }}>
              <button className="moments-btn" type="button" onClick={() => setScreen('upload')}>
                شارك صورة أو فيديو
              </button>
              <button className="moments-btn-quiet" type="button" onClick={() => setScreen('message')}>
                اكتب رسالة أخرى
              </button>
            </div>
          </section>
        )}
      </div>

      {sheetOpen && (
        <>
          <button className="moments-overlay" type="button" aria-label="إغلاق" onClick={() => setSheetOpen(false)} />
          <div className="moments-sheet" dir="rtl">
            <h3>قبل أن نبدأ 🤍</h3>
            <p className="moments-muted">نحب أن نعرف ممن وصلتنا هذه الذكرى</p>
            <label style={{ display: 'block', marginTop: '1.1rem' }}>اسمك</label>
            <input className="moments-field" value={name} maxLength={60} autoFocus onChange={(e) => setName(e.target.value)} />
            <button className="moments-btn" style={{ marginTop: '1.1rem' }} disabled={busy || !name.trim()} onClick={() => void identify()}>
              ابدأ
            </button>
            <p className="moments-muted" style={{ textAlign: 'center', marginTop: '0.9rem', fontSize: '0.8rem' }}>
              سنحفظ اسمك على هذا الجهاز فقط لتجميع ذكرياتك معنا.
            </p>
          </div>
        </>
      )}

      {confirm && (
        <ConfirmSheet
          title={confirm.kind === 'delete' ? 'تأكيد الحذف' : 'تأكيد تبديل الضيف'}
          body={
            confirm.kind === 'delete'
              ? 'بدك تحذف هذه الذكرى؟ ما رح تقدر ترجعها بعد الحذف.'
              : `الجهاز مسجّل الآن باسم ${guest?.displayName ?? 'ضيف'}. إذا اخترت "هذا ليس أنا" رح نفتح جلسة جديدة لشخص ثاني.`
          }
          confirmLabel={confirm.kind === 'delete' ? 'نعم، احذف' : 'نعم، هذا ليس أنا'}
          busy={busy}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            if (confirm.kind === 'delete') {
              setBusy(true)
              try {
                await memoriesApi.remove(token, confirm.mediaId)
                await refreshGuest(token)
                setConfirm(null)
                showToast('تم حذف الذكرى')
              } catch {
                showToast('تعذّر الحذف، حاول مرة أخرى')
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
      {lightbox && <Lightbox {...lightbox} onClose={() => setLightbox(null)} />}
      {storyViewer}
      {toast && <div className="moments-toast">{toast}</div>}
    </div>
  )
}

function ConfirmSheet({
  title,
  body,
  confirmLabel,
  busy,
  onClose,
  onConfirm,
}: {
  title: string
  body: string
  confirmLabel: string
  busy: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
}) {
  return (
    <>
      <button className="moments-overlay" type="button" aria-label="إغلاق" onClick={onClose} />
      <div className="moments-sheet" dir="rtl">
        <h3>{title}</h3>
        <p className="moments-muted" style={{ marginTop: '0.6rem' }}>
          {body}
        </p>
        <div className="moments-confirm-actions">
          <button className="moments-btn" type="button" disabled={busy} onClick={() => void onConfirm()}>
            {confirmLabel}
          </button>
          <button className="moments-btn-quiet" type="button" disabled={busy} onClick={onClose}>
            إلغاء
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
  onClose,
}: {
  url: string
  type: string
  loading?: boolean
  onClose: () => void
}) {
  const [buffering, setBuffering] = useState(type === 'video')
  const showLoader = Boolean(loading) || (type === 'video' && buffering)

  return (
    <div className="moments-lightbox">
      <button type="button" onClick={onClose} style={{ position: 'absolute', top: '1rem', insetInlineEnd: '1rem', color: '#fff' }}>
        إغلاق
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
            <span>{type === 'video' ? 'جاري تحميل الفيديو...' : 'جاري التحميل...'}</span>
          </div>
        )}
      </div>
    </div>
  )
}
