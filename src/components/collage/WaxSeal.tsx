import { collageAssets, layout } from './layout'
import { LayerShell } from './LayerShell'

export function WaxSeal() {
  return (
    <LayerShell coords={layout.waxSeal}>
      <img
        src={collageAssets.waxSeal}
        alt=""
        draggable={false}
        className="h-full w-full object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.18)]"
      />
    </LayerShell>
  )
}
