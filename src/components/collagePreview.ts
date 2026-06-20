import type { Transition } from 'framer-motion'

export type PreviewItemId = 'largePhoto' | 'smallPhoto' | 'goldTicket' | 'tornNote'

export function previewLayoutId(id: PreviewItemId): string {
  return `collage-preview-${id}`
}

export const previewEase = [0.22, 1, 0.36, 1] as const

export const previewTransition: Transition = {
  type: 'tween',
  duration: 0.55,
  ease: previewEase,
}

export const previewEnter = {
  initial: { opacity: 0, scale: 0.85 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.85 },
  transition: previewTransition,
} as const
