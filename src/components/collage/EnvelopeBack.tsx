import { collageAssets, layout } from './layout'
import { LayerShell } from './LayerShell'

export function EnvelopeBack() {
  return (
    <LayerShell coords={layout.envelopeBack}>
      <img
        src={collageAssets.envelopeBack}
        alt=""
        draggable={false}
        className="h-full w-full object-cover object-bottom"
      />
    </LayerShell>
  )
}
