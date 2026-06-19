import { COLLAGE_ARTBOARD } from './layout'

export function CollageContainer() {
  return (
    <div
      className="relative overflow-hidden bg-white"
      style={{
        width: COLLAGE_ARTBOARD.width,
        height: COLLAGE_ARTBOARD.height,
      }}
    />
  )
}
