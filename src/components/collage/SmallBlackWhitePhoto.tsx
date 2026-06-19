import { collageAssets, layout } from './layout'
import { LayerShell } from './LayerShell'

export function SmallBlackWhitePhoto() {
  return (
    <LayerShell coords={layout.smallPhoto}>
      <div className="h-full w-full border-[3px] border-[#f5f0e8] bg-[#f5f0e8] shadow-sm">
        <img
          src={collageAssets.smallPhoto}
          alt=""
          draggable={false}
          className="h-full w-full object-cover grayscale"
        />
      </div>
    </LayerShell>
  )
}
