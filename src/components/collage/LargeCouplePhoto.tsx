import { collageAssets, layout } from './layout'
import { LayerShell } from './LayerShell'

export function LargeCouplePhoto() {
  return (
    <LayerShell coords={layout.largePhoto}>
      <div className="h-full w-full border-[3px] border-[#f5f0e8] bg-[#f5f0e8] shadow-sm">
        <img
          src={collageAssets.largePhoto}
          alt=""
          draggable={false}
          className="h-full w-full object-cover"
        />
      </div>
    </LayerShell>
  )
}
