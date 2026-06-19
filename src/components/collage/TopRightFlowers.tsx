import { collageAssets, layout } from './layout'
import { LayerShell } from './LayerShell'

export function TopRightFlowers() {
  return (
    <LayerShell coords={layout.topRightFlowers}>
      <img
        src={collageAssets.topRightFlowers}
        alt=""
        draggable={false}
        className="h-full w-full object-contain"
      />
    </LayerShell>
  )
}
