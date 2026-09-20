import { useEffect, useRef, useState } from 'react'
import './VideoPoster.css'

const frameCache = new Map<string, string>()

function cacheKey(src?: string | null, poster?: string | null) {
  return poster || src || ''
}

async function captureVideoFrame(src: string): Promise<string | null> {
  const cached = frameCache.get(src)
  if (cached) return cached

  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.muted = true
    video.defaultMuted = true
    video.playsInline = true
    video.autoplay = true
    video.preload = 'auto'
    if (!src.startsWith('/') && !src.startsWith(window.location.origin)) {
      video.crossOrigin = 'anonymous'
    }
    video.setAttribute('playsinline', 'true')
    video.setAttribute('webkit-playsinline', 'true')
    video.setAttribute('muted', 'true')
    video.style.cssText = 'position:fixed;left:-240px;top:0;width:160px;height:90px;opacity:0;pointer-events:none;'
    document.body.appendChild(video)

    let settled = false
    const finish = (frame: string | null) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      video.pause()
      video.removeAttribute('src')
      video.load()
      video.remove()
      if (frame) frameCache.set(src, frame)
      resolve(frame)
    }

    const snap = () => {
      if (!video.videoWidth || !video.videoHeight) return false
      const max = 720
      const scale = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) return false
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      try {
        const data = canvas.toDataURL('image/jpeg', 0.74)
        if (data.length < 80) return false
        finish(data)
        return true
      } catch {
        return false
      }
    }

    const seek = () => {
      const time = Number.isFinite(video.duration) && video.duration > 0 ? Math.min(0.35, video.duration * 0.08) : 0.2
      try {
        video.currentTime = time
      } catch {
        snap()
      }
    }

    video.addEventListener('seeked', () => {
      if (snap()) return
      if (video.videoWidth) finish(null)
    })
    video.addEventListener('loadeddata', () => {
      void video
        .play()
        .then(() => {
          video.pause()
          if (!snap()) seek()
        })
        .catch(() => {
          if (!snap()) seek()
        })
    })
    video.addEventListener('error', () => finish(null))
    const timer = window.setTimeout(() => finish(null), 16000)
    video.src = src
    video.load()
    void video.play().catch(() => undefined)
  })
}

export function VideoPoster({
  src,
  poster,
  captureSrc,
  className,
  onFrame,
}: {
  src?: string | null
  poster?: string | null
  captureSrc?: string | null
  className?: string
  onFrame?: (dataUrl: string) => void
}) {
  const initial = poster || (src ? frameCache.get(src) : null) || null
  const [frame, setFrame] = useState<string | null>(initial)
  const [busy, setBusy] = useState(!initial)
  const onFrameRef = useRef(onFrame)
  onFrameRef.current = onFrame

  useEffect(() => {
    if (poster) {
      setFrame(poster)
      setBusy(false)
      return
    }
    const cachedFrom = [poster, captureSrc, src].find((value) => value && frameCache.has(value))
    if (cachedFrom) {
      setFrame(frameCache.get(cachedFrom) ?? null)
      setBusy(false)
      return
    }
    const captureFrom = captureSrc || src
    if (!captureFrom) {
      setBusy(false)
      return
    }
    let cancelled = false
    setBusy(true)
    void captureVideoFrame(captureFrom).then((next) => {
      if (cancelled) return
      if (next) {
        setFrame(next)
        onFrameRef.current?.(next)
      }
      setBusy(false)
    })
    return () => {
      cancelled = true
      void cacheKey(src, poster)
    }
  }, [src, poster, captureSrc])

  return (
    <span className={`video-poster${className ? ` ${className}` : ''}`}>
      {frame ? (
        <img src={frame} alt="" />
      ) : src ? (
        <video
          src={src}
          muted
          playsInline
          autoPlay
          preload="auto"
          onLoadedData={(event) => {
            const video = event.currentTarget
            const time = Number.isFinite(video.duration) && video.duration > 0 ? Math.min(0.35, video.duration * 0.08) : 0.2
            try {
              video.currentTime = time
            } catch {
              /* iOS may ignore seek until ready */
            }
            void video.play().then(() => video.pause()).catch(() => undefined)
          }}
        />
      ) : (
        <span className="video-poster-overlay" aria-hidden>
          <span className="video-poster-spinner" />
        </span>
      )}
      {busy && !frame ? (
        <span className="video-poster-overlay" aria-hidden>
          <span className="video-poster-spinner" />
        </span>
      ) : null}
    </span>
  )
}
