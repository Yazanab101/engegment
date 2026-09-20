import { useCallback, useEffect, useRef, useState } from 'react'
import { playbackDurationSeconds } from './story-core'
import { getStoryMutePref, setStoryMutePref } from './guest-session'
import './moments.css'

export type StoryItem = {
  id: string
  mediaType: 'photo' | 'video'
  duration: number | null
  createdAt: string
}

type MediaPayload = {
  url: string
  thumbUrl: string | null
  mediaType: 'photo' | 'video'
}

export function StoryViewer({
  stories,
  startIndex = 0,
  coupleLabel,
  dir = 'rtl',
  getMedia,
  onViewed,
  onClose,
}: {
  stories: StoryItem[]
  startIndex?: number
  coupleLabel: string
  dir?: 'rtl' | 'ltr'
  getMedia: (storyId: string) => Promise<MediaPayload>
  onViewed?: (storyId: string) => void
  onClose: () => void
}) {
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(0, startIndex), Math.max(0, stories.length - 1)),
  )
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(getStoryMutePref)
  const [progress, setProgress] = useState(0)
  const [media, setMedia] = useState<Record<string, MediaPayload>>({})
  const videoRef = useRef<HTMLVideoElement>(null)
  const preloadVideoRef = useRef<HTMLVideoElement>(null)
  const indexRef = useRef(index)
  const pausedRef = useRef(paused)
  const progressRef = useRef(0)
  const elapsedRef = useRef(0)
  const durationRef = useRef(7)
  const lastTsRef = useRef<number | null>(null)
  const holdRef = useRef(false)
  const holdTimerRef = useRef<number>(0)
  const finishingRef = useRef(false)
  const pointerRef = useRef<{ x: number; y: number; t: number } | null>(null)
  const viewedRef = useRef(new Set<string>())

  const story = stories[index]
  const current = story ? media[story.id] : undefined
  const nextStory = stories[index + 1]

  useEffect(() => {
    indexRef.current = index
  }, [index])
  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prevHtml = html.style.overflow
    const prevBody = body.style.overflow
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    html.classList.add('story-viewer-open')
    return () => {
      html.style.overflow = prevHtml
      body.style.overflow = prevBody
      html.classList.remove('story-viewer-open')
    }
  }, [])

  const load = useCallback(
    async (item: StoryItem | undefined) => {
      if (!item || media[item.id]) return
      try {
        const payload = await getMedia(item.id)
        setMedia((prev) => (prev[item.id] ? prev : { ...prev, [item.id]: payload }))
      } catch {
        // viewer keeps going; tap right to skip
      }
    },
    [getMedia, media],
  )

  useEffect(() => {
    void load(story)
    void load(nextStory)
  }, [load, story, nextStory])

  useEffect(() => {
    if (!story) return
    if (viewedRef.current.has(story.id)) return
    viewedRef.current.add(story.id)
    onViewed?.(story.id)
  }, [story, onViewed])

  const close = useCallback(() => {
    videoRef.current?.pause()
    onClose()
  }, [onClose])

  const goTo = useCallback(
    (next: number) => {
      if (next < 0) return
      if (next >= stories.length) {
        close()
        return
      }
      videoRef.current?.pause()
      elapsedRef.current = 0
      progressRef.current = 0
      lastTsRef.current = null
      finishingRef.current = false
      setProgress(0)
      setPaused(false)
      setIndex(next)
    },
    [close, stories.length],
  )

  const next = useCallback(() => goTo(indexRef.current + 1), [goTo])
  const prev = useCallback(() => goTo(Math.max(0, indexRef.current - 1)), [goTo])

  useEffect(() => {
    elapsedRef.current = 0
    progressRef.current = 0
    lastTsRef.current = null
    finishingRef.current = false
    setProgress(0)
    durationRef.current = playbackDurationSeconds({
      mediaType: story?.mediaType ?? 'photo',
      configuredDuration: story?.duration,
    })
  }, [story?.id, story?.duration, story?.mediaType])

  useEffect(() => {
    const video = videoRef.current
    if (!video || story?.mediaType !== 'video' || !current?.url) return
    video.muted = muted
    const start = async () => {
      try {
        video.currentTime = 0
        await video.play()
      } catch {
        video.muted = true
        setMuted(true)
        setStoryMutePref(true)
        try {
          await video.play()
        } catch {
          // still paused; hold/tap still work
        }
      }
    }
    void start()
    return () => video.pause()
  }, [current?.url, muted, story?.id, story?.mediaType])

  useEffect(() => {
    const preload = preloadVideoRef.current
    if (!preload || nextStory?.mediaType !== 'video') return
    const nextMedia = nextStory ? media[nextStory.id] : undefined
    if (!nextMedia?.url) return
    preload.preload = 'metadata'
    preload.src = nextMedia.url
  }, [media, nextStory])

  useEffect(() => {
    let frame = 0
    const tick = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts
      const dt = (ts - lastTsRef.current) / 1000
      lastTsRef.current = ts
      const video = videoRef.current
      if (!pausedRef.current && story) {
        if (story.mediaType === 'video' && video && Number.isFinite(video.currentTime)) {
          const cap = playbackDurationSeconds({
            mediaType: 'video',
            configuredDuration: story.duration,
            mediaDuration: Number.isFinite(video.duration) ? video.duration : story.duration,
          })
          durationRef.current = cap
          elapsedRef.current = Math.min(cap, video.currentTime)
          if (video.currentTime >= cap - 0.05) {
            video.pause()
            if (!finishingRef.current) {
              finishingRef.current = true
              next()
            }
            frame = requestAnimationFrame(tick)
            return
          }
        } else {
          elapsedRef.current += dt
        }
        const duration = Math.max(0.2, durationRef.current)
        const ratio = Math.min(1, elapsedRef.current / duration)
        progressRef.current = ratio
        setProgress(ratio)
        if (story.mediaType === 'photo' && ratio >= 1 && !finishingRef.current) {
          finishingRef.current = true
          next()
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [next, story])

  const toggleMute = (event: React.MouseEvent) => {
    event.stopPropagation()
    const nextMuted = !muted
    setMuted(nextMuted)
    setStoryMutePref(nextMuted)
    if (videoRef.current) videoRef.current.muted = nextMuted
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    pointerRef.current = { x: event.clientX, y: event.clientY, t: Date.now() }
    holdRef.current = false
    window.clearTimeout(holdTimerRef.current)
    holdTimerRef.current = window.setTimeout(() => {
      const pointer = pointerRef.current
      if (!pointer) return
      holdRef.current = true
      setPaused(true)
      videoRef.current?.pause()
    }, 180)
  }

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    window.clearTimeout(holdTimerRef.current)
    const pointer = pointerRef.current
    pointerRef.current = null
    if (!pointer) return
    const dx = event.clientX - pointer.x
    const dy = event.clientY - pointer.y
    if (holdRef.current) {
      holdRef.current = false
      setPaused(false)
      if (story?.mediaType === 'video') void videoRef.current?.play().catch(() => undefined)
      return
    }
    if (dy > 72 && Math.abs(dy) > Math.abs(dx)) {
      close()
      return
    }
    if (Date.now() - pointer.t > 280) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    if (x < rect.width * 0.35) prev()
    else next()
  }

  const timestamp = story
    ? new Date(story.createdAt).toLocaleString('ar', { hour: '2-digit', minute: '2-digit' })
    : ''

  if (!story) return null

  return (
    <div dir={dir} className="story-viewer" role="dialog" aria-modal="true" aria-label={coupleLabel}>
      <div className="story-viewer-top">
        <div className="story-viewer-bars">
          {stories.map((item, i) => (
            <div key={item.id} className="story-viewer-bar">
              <div
                className="story-viewer-bar-fill"
                style={{
                  width: i < index ? '100%' : i > index ? '0%' : `${Math.round(progress * 100)}%`,
                }}
              />
            </div>
          ))}
        </div>
        <div className="story-viewer-meta">
          <div>
            <p className="story-viewer-couple" dir="ltr">
              {coupleLabel}
            </p>
            <p className="story-viewer-time">{timestamp}</p>
          </div>
          <button type="button" aria-label="إغلاق" onClick={close} className="story-viewer-close">
            ×
          </button>
        </div>
      </div>

      <div
        className="story-viewer-stage"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          pointerRef.current = null
          if (holdRef.current) {
            holdRef.current = false
            setPaused(false)
            void videoRef.current?.play().catch(() => undefined)
          }
        }}
      >
        <div className="story-viewer-media">
          {current?.mediaType === 'video' || story.mediaType === 'video' ? (
            <video
              key={story.id}
              ref={videoRef}
              src={current?.url}
              playsInline
              muted={muted}
              preload="metadata"
              onEnded={() => {
                if (!finishingRef.current) {
                  finishingRef.current = true
                  next()
                }
              }}
            />
          ) : current?.url ? (
            <img src={current.url} alt="" />
          ) : (
            <div className="story-viewer-pulse" />
          )}
        </div>
      </div>

      {story.mediaType === 'video' ? (
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
          className="story-viewer-mute"
        >
          {muted ? '🔇' : '🔊'}
        </button>
      ) : null}

      <video ref={preloadVideoRef} className="story-viewer-preload" muted playsInline preload="metadata" />
    </div>
  )
}
