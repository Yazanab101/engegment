import { collageAssets, layout } from './layout'
import { LayerShell } from './LayerShell'

export function TopLeftFlowers() {
  return (
    <LayerShell coords={layout.topLeftFlowers}>
      <img
        src={collageAssets.topLeftFlowers}
        alt=""
        draggable={false}
        className="h-full w-full object-contain"
      />
    </LayerShell>
  )
}
