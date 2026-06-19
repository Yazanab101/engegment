import { collageAssets, layout } from './layout'
import { LayerShell } from './LayerShell'

export function TornPaperNote() {
  return (
    <LayerShell coords={layout.tornNote}>
      <img
        src={collageAssets.tornNote}
        alt=""
        draggable={false}
        className="h-full w-full object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
      />
    </LayerShell>
  )
}
