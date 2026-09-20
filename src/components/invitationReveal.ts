import type { Transition } from 'framer-motion'

/** Premium ease-out — no overshoot */
export const luxuryEase = [0.22, 1, 0.36, 1] as const

export function revealTransition(delay: number, duration = 1.05): Transition {
  return {
    delay,
    duration,
    ease: luxuryEase,
  }
}

export function revealSpring(delay: number): Transition {
  return {
    type: 'spring',
    stiffness: 68,
    damping: 22,
    mass: 0.95,
    delay,
  }
}

/** Snappy ticket pop — no lingering double-image */
export function ticketRevealSpring(delay: number): Transition {
  return {
    type: 'spring',
    stiffness: 220,
    damping: 26,
    mass: 0.65,
    delay,
  }
}

/** Instant show/hide when opening or closing ticket preview */
export const ticketPreviewToggle: Transition = {
  type: 'tween',
  duration: 0,
  delay: 0,
}

/** Staggered reveal order (seconds) */
export const REVEAL = {
  envelopeBack: 0,
  couplePhoto: 0.22,
  couplePhotoBw: 0.4,
  tornNote: 0.58,
  ticket: 0.4,
  topFlowers: 0.98,
  frontFlowers: 1.2,
} as const

export const slideUpReveal = {
  initial: { opacity: 0, y: 120, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
} as const

/** Ticket slide — tilt/flip stay in CSS on inner layers */
export const ticketSlideReveal = {
  initial: { opacity: 0, y: 72, scale: 0.98, x: '-50%' },
  animate: { opacity: 1, y: 0, scale: 1, x: '-50%' },
} as const
