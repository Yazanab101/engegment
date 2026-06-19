/** Canva page-1 ("Envelope") artboard — from bootstrap layout data */
export const ENVELOPE_ARTBOARD = {
  width: 1366,
  height: 1417,
} as const

export type EnvelopeLayer = {
  left: number
  top: number
  width: number
  height: number
  z: number
}

/** A = left, B = top, D = width, C = height (Canva coordinates) */
export const envelopeLayout = {
  envelope: {
    left: 280.587,
    top: 125.811,
    width: 1051.807,
    height: 714.467,
    z: 2,
  },
  tagline: {
    left: 435.692,
    top: 529.299,
    width: 328.98,
    height: 108.42,
    fontSize: 38.1365,
    color: '#29120b',
    z: 3,
  },
  floralLeft: {
    left: 240.212,
    top: 125.811,
    width: 351.645,
    height: 454.642,
    z: 5,
  },
  floralRight: {
    left: 694.854,
    top: 856.05,
    width: 384.139,
    height: 384.139,
    z: 4,
  },
  tapText: {
    fontSize: 28.1128,
  },
} as const satisfies Record<string, EnvelopeLayer | { fontSize: number; color?: string }>

export function artboardPct(value: number, axis: 'w' | 'h') {
  const total = axis === 'w' ? ENVELOPE_ARTBOARD.width : ENVELOPE_ARTBOARD.height
  return `${(value / total) * 100}%`
}

export function artboardFontSize(size: number) {
  return `${(size / ENVELOPE_ARTBOARD.width) * 100}cqw`
}
