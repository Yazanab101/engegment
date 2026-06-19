import { CANVA_ENVELOPE_FRONT_OFFSET, collageAssets, layout } from './layout'
import { LayerShell } from './LayerShell'

/** Canva envelope front pocket — covers lower inserted items */
export function EnvelopeFront() {
  return (
    <LayerShell coords={layout.envelopeFront}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden bg-white">
        <img
          src={collageAssets.envelopeFront}
          alt=""
          draggable={false}
          className="absolute h-full w-full object-contain object-bottom mix-blend-screen drop-shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
          style={{
            transform: `translate(${CANVA_ENVELOPE_FRONT_OFFSET.x}px, ${CANVA_ENVELOPE_FRONT_OFFSET.y}px)`,
          }}
        />
      </div>
      <p
        className="pointer-events-none absolute bottom-[18%] left-1/2 w-full -translate-x-1/2 text-center font-['New_Icon'] text-[11px] tracking-[0.35em] text-black uppercase"
        aria-hidden
      >
        A <span className="font-['Parfumerie_Script'] text-[13px] normal-case tracking-normal">&amp;</span> M
      </p>
    </LayerShell>
  )
}
