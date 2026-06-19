import { collageAssets, layout } from './layout'
import { LayerShell } from './LayerShell'

export function FrontFlowers() {
  return (
    <LayerShell coords={layout.frontFlowers}>
      <img
        src={collageAssets.frontFlowers}
        alt=""
        draggable={false}
        className="h-full w-full object-contain"
      />
    </LayerShell>
  )
}
