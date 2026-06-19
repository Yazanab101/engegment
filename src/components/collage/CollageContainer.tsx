import { COLLAGE_ARTBOARD } from './layout'
import { EnvelopeBack } from './EnvelopeBack'
import { EnvelopeFront } from './EnvelopeFront'
import { LargeCouplePhoto } from './LargeCouplePhoto'
import { SmallBlackWhitePhoto } from './SmallBlackWhitePhoto'
import { TornPaperNote } from './TornPaperNote'
import { TopLeftFlowers } from './TopLeftFlowers'
import { TopRightFlowers } from './TopRightFlowers'
import { GoldTicket } from './GoldTicket'
import { FrontFlowers } from './FrontFlowers'
import { WaxSeal } from './WaxSeal'

export function CollageContainer() {
  return (
    <div
      className="relative overflow-hidden bg-white"
      style={{
        width: COLLAGE_ARTBOARD.width,
        height: COLLAGE_ARTBOARD.height,
      }}
    >
      <EnvelopeBack />
      <LargeCouplePhoto />
      <SmallBlackWhitePhoto />
      <TornPaperNote />
      <TopLeftFlowers />
      <TopRightFlowers />
      <GoldTicket />
      <EnvelopeFront />
      <FrontFlowers />
      <WaxSeal />
    </div>
  )
}
