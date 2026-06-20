type SfxId = 'envelopeOpen' | 'revealShimmer'

const SFX_SOURCES: Record<SfxId, string> = {
  envelopeOpen: '/audio/envelope-open.mp3',
  revealShimmer: '/audio/reveal-shimmer.mp3',
}

const SFX_VOLUMES: Record<SfxId, number> = {
  envelopeOpen: 0.25,
  revealShimmer: 0.18,
}

const PIANO_SRC = '/audio/engagement-piano.mp3'
const PIANO_VOLUME = 0.2
const PIANO_FADE_IN_MS = 1000
const PIANO_FADE_OUT_SEC = 2

const sfxElements = new Map<SfxId, HTMLAudioElement>()
const sfxPlaying = new Set<SfxId>()

let pianoElement: HTMLAudioElement | null = null
let pianoFadeFrame: number | null = null
let pianoPlayed = false
let pianoPlaying = false
let unlocked = false

function getSfx(id: SfxId): HTMLAudioElement {
  let audio = sfxElements.get(id)
  if (!audio) {
    audio = new Audio(SFX_SOURCES[id])
    audio.preload = 'auto'
    sfxElements.set(id, audio)
  }
  audio.volume = SFX_VOLUMES[id]
  return audio
}

function getPiano(): HTMLAudioElement {
  if (!pianoElement) {
    pianoElement = new Audio(PIANO_SRC)
    pianoElement.preload = 'auto'
  }
  return pianoElement
}

function cancelPianoFade(): void {
  if (pianoFadeFrame !== null) {
    cancelAnimationFrame(pianoFadeFrame)
    pianoFadeFrame = null
  }
}

function fadePianoVolume(
  audio: HTMLAudioElement,
  from: number,
  to: number,
  durationMs: number,
  onComplete?: () => void,
): void {
  cancelPianoFade()
  const start = performance.now()

  const tick = (now: number) => {
    const progress = Math.min(1, (now - start) / durationMs)
    audio.volume = from + (to - from) * progress

    if (progress < 1) {
      pianoFadeFrame = requestAnimationFrame(tick)
    } else {
      pianoFadeFrame = null
      onComplete?.()
    }
  }

  pianoFadeFrame = requestAnimationFrame(tick)
}

export function preloadInvitationAudio(): void {
  ;(Object.keys(SFX_SOURCES) as SfxId[]).forEach((id) => {
    getSfx(id).load()
  })
}

export function preloadEngagementPiano(): void {
  getPiano().load()
}

/** Call from a user-gesture handler before any playback (required on mobile). */
export function unlockInvitationAudio(): void {
  if (unlocked) return
  unlocked = true
  preloadInvitationAudio()
  preloadEngagementPiano()
}

function playSfx(id: SfxId): void {
  if (!unlocked) return

  const audio = getSfx(id)
  if (sfxPlaying.has(id)) {
    audio.pause()
    audio.currentTime = 0
    sfxPlaying.delete(id)
  }

  const onEnded = () => {
    sfxPlaying.delete(id)
    audio.removeEventListener('ended', onEnded)
  }

  audio.addEventListener('ended', onEnded)
  audio.currentTime = 0
  sfxPlaying.add(id)

  void audio.play().catch(() => {
    sfxPlaying.delete(id)
    audio.removeEventListener('ended', onEnded)
  })
}

export function playEnvelopeOpen(): void {
  playSfx('envelopeOpen')
}

export function playRevealShimmer(): void {
  playSfx('revealShimmer')
}

export function playEngagementPiano(): void {
  if (!unlocked || pianoPlayed || pianoPlaying) return

  const audio = getPiano()
  pianoPlayed = true
  pianoPlaying = true

  cancelPianoFade()
  audio.pause()
  audio.currentTime = 0
  audio.volume = 0

  let fadeInDone = false

  const onTimeUpdate = () => {
    if (!fadeInDone || !Number.isFinite(audio.duration)) return
    const remaining = audio.duration - audio.currentTime
    if (remaining <= PIANO_FADE_OUT_SEC) {
      audio.volume = PIANO_VOLUME * Math.max(0, remaining / PIANO_FADE_OUT_SEC)
    } else if (pianoFadeFrame === null) {
      audio.volume = PIANO_VOLUME
    }
  }

  const onEnded = () => {
    pianoPlaying = false
    cancelPianoFade()
    audio.removeEventListener('timeupdate', onTimeUpdate)
    audio.removeEventListener('ended', onEnded)
    audio.volume = 0
  }

  audio.addEventListener('timeupdate', onTimeUpdate)
  audio.addEventListener('ended', onEnded)

  void audio.play().then(() => {
    fadePianoVolume(audio, 0, PIANO_VOLUME, PIANO_FADE_IN_MS, () => {
      fadeInDone = true
      audio.volume = PIANO_VOLUME
    })
  }).catch(() => {
    pianoPlaying = false
    audio.removeEventListener('timeupdate', onTimeUpdate)
    audio.removeEventListener('ended', onEnded)
  })
}

export function stopInvitationAudio(): void {
  sfxElements.forEach((audio) => {
    audio.pause()
    audio.currentTime = 0
  })
  sfxPlaying.clear()

  if (pianoElement) {
    cancelPianoFade()
    pianoElement.pause()
    pianoElement.currentTime = 0
    pianoElement.volume = 0
    pianoPlaying = false
  }
}
