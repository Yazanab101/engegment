import type { CSSProperties, ReactNode } from 'react'
import type { LayerCoords } from './layout'

type LayerShellProps = {
  coords: LayerCoords
  children: ReactNode
  className?: string
}

export function layerStyle(coords: LayerCoords): CSSProperties {
  return {
    position: 'absolute',
    top: coords.top,
    left: coords.left,
    right: coords.right,
    width: coords.width,
    height: coords.height,
    transform: coords.rotate ? `rotate(${coords.rotate}deg)` : undefined,
    transformOrigin: 'center center',
    zIndex: coords.z,
  }
}

export function LayerShell({ coords, children, className = '' }: LayerShellProps) {
  return (
    <div className={className} style={layerStyle(coords)}>
      {children}
    </div>
  )
}
