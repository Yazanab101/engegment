import { collageAssets, layout } from './layout'
import { LayerShell } from './LayerShell'

export function GoldTicket() {
  return (
    <LayerShell coords={layout.goldTicket}>
      <img
        src={collageAssets.goldTicket}
        alt="Save the Date"
        draggable={false}
        className="h-full w-full object-contain drop-shadow-[0_6px_20px_rgba(0,0,0,0.14)]"
      />
    </LayerShell>
  )
}
