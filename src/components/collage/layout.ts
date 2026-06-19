/** Fixed collage artboard — adjust coordinates here */
export const COLLAGE_ARTBOARD = {
  width: 390,
  height: 620,
} as const

export type LayerCoords = {
  top: number
  left?: number
  right?: number
  width: number
  height?: number
  rotate: number
  z: number
}

/** Canva demo scale: 205.961px → 390px artboard */
export const CANVA_SCALE = 390 / 205.961

/** Inner img offset from Canva transform translate(-39.96px, -55.68px) */
export const CANVA_ENVELOPE_FRONT_OFFSET = {
  x: -39.9586 * CANVA_SCALE,
  y: -55.676 * CANVA_SCALE,
} as const

export const layout = {
  envelopeBack: {
    top: 270,
    left: 0,
    width: 390,
    height: 300,
    rotate: 0,
    z: 1,
  },
  largePhoto: {
    top: 10,
    left: 88,
    width: 220,
    height: 270,
    rotate: -4,
    z: 2,
  },
  smallPhoto: {
    top: 145,
    left: 15,
    width: 90,
    height: 155,
    rotate: -10,
    z: 3,
  },
  tornNote: {
    top: 75,
    right: 10,
    width: 110,
    height: 145,
    rotate: 7,
    z: 4,
  },
  topLeftFlowers: {
    top: 95,
    left: 0,
    width: 105,
    height: 130,
    rotate: 0,
    z: 5,
  },
  topRightFlowers: {
    top: 35,
    right: 0,
    width: 105,
    height: 130,
    rotate: 0,
    z: 5,
  },
  goldTicket: {
    top: 220,
    left: 30,
    width: 340,
    height: 145,
    rotate: -13,
    z: 6,
  },
  envelopeFront: {
    top: 310,
    left: 0,
    width: 390,
    height: Math.round(137.307 * CANVA_SCALE),
    rotate: 0,
    z: 7,
  },
  frontFlowers: {
    top: 330,
    right: 35,
    width: 135,
    height: 160,
    rotate: 0,
    z: 9,
  },
  waxSeal: {
    top: 405,
    left: 170,
    width: 55,
    height: 55,
    rotate: 0,
    z: 10,
  },
} as const satisfies Record<string, LayerCoords>

export const collageAssets = {
  envelopeBack: '/assets/canva/envelope-open.png',
  envelopeFront: '/assets/canva/envelope-front-pocket.png',
  largePhoto: '/assets/canva/couple-photo.png',
  smallPhoto: '/assets/canva/photo-bw-couple.png',
  tornNote: '/assets/canva/torn-note.png',
  topLeftFlowers: '/assets/canva/floral-left.png',
  topRightFlowers: '/assets/canva/floral-top-right.png',
  frontFlowers: '/assets/canva/floral-br.png',
  goldTicket: '/assets/canva/gold-ticket.png',
  waxSeal: '/assets/canva/MAHKaD_37to.png',
} as const
