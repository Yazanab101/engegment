import { useCallback, useState } from 'react'
import { LayoutGroup, motion } from 'framer-motion'
import { useInvitationAudio } from '../hooks/useInvitationAudio'
import { assets, invitation } from '../data/invitation'
import {
  InteractivePreviewLayer,
  PreviewTarget,
  TicketGroup,
  TornNoteGroup,
} from './InteractivePreviewLayer'
import type { PreviewItemId } from './collagePreview'
import {
  REVEAL,
  revealSpring,
  revealTransition,
  slideUpReveal,
  ticketSlideReveal,
} from './invitationReveal'
import styles from './InvitationHero.module.css'

interface InvitationHeroProps {
  onClose: () => void
  disabled?: boolean
}

export function InvitationHero({ onClose, disabled }: InvitationHeroProps) {
  useInvitationAudio()
  const [selectedItem, setSelectedItem] = useState<PreviewItemId | null>(null)

  const handleSelect = useCallback((id: PreviewItemId) => {
    setSelectedItem(id)
  }, [])

  const handleClosePreview = useCallback(() => {
    setSelectedItem(null)
  }, [])

  const ticketHidden = selectedItem === 'goldTicket'

  return (
    <LayoutGroup id="collage-preview">
      <motion.div
        className={styles.page}
        layoutRoot
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <InteractivePreviewLayer selectedItem={selectedItem} onClose={handleClosePreview} />

        <div className={styles.canvas}>
          <div className={styles.envelopeWrap}>
            <div className={styles.envelopeStack}>
              <div className={styles.envelopeScale}>
                <motion.img
                  className={styles.envelopeInterior}
                  src={assets.envelopeInterior}
                  alt=""
                  aria-hidden
                  draggable={false}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={revealTransition(REVEAL.envelopeBack, 0.85)}
                />

                <motion.img
                  className={styles.floralBehindLeft}
                  src={assets.floralBottomLeft}
                  alt=""
                  aria-hidden
                  draggable={false}
                  initial={{ opacity: 0, y: 48, x: -24, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
                  transition={revealSpring(REVEAL.topFlowers)}
                />

                <motion.img
                  className={styles.floralBehindRight}
                  src={assets.floralBottomLeft}
                  alt=""
                  aria-hidden
                  draggable={false}
                  initial={{ opacity: 0, y: 48, x: 24, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
                  transition={revealSpring(REVEAL.topFlowers)}
                />

                <PreviewTarget
                  id="largePhoto"
                  selectedItem={selectedItem}
                  onSelect={handleSelect}
                  className={styles.couplePhotoWrap}
                  ariaLabel="View couple photo"
                >
                  <motion.img
                    className={styles.couplePhoto}
                    src={assets.couplePhotoTicketBg}
                    alt=""
                    aria-hidden
                    draggable={false}
                    initial={{ ...slideUpReveal.initial, rotate: -4 }}
                    animate={{ ...slideUpReveal.animate, rotate: -4 }}
                    transition={revealSpring(REVEAL.couplePhoto)}
                  />
                </PreviewTarget>

                <PreviewTarget
                  id="smallPhoto"
                  selectedItem={selectedItem}
                  onSelect={handleSelect}
                  className={styles.couplePhotoBwWrap}
                  ariaLabel="View black and white photo"
                >
                  <motion.img
                    className={styles.couplePhotoBw}
                    src={assets.couplePhotoBw}
                    alt=""
                    aria-hidden
                    draggable={false}
                    initial={{ opacity: 0, x: 28, y: 120, scale: 0.96, rotate: -12 }}
                    animate={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: -12 }}
                    transition={revealSpring(REVEAL.couplePhotoBw)}
                  />
                </PreviewTarget>

                <PreviewTarget
                  id="tornNote"
                  selectedItem={selectedItem}
                  onSelect={handleSelect}
                  className={styles.tornNoteBlock}
                  ariaLabel="View celebration note"
                >
                  <motion.div
                    aria-hidden
                    initial={{ opacity: 0, x: -32, y: 120, scale: 0.96, rotate: 7 }}
                    animate={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: 7 }}
                    transition={revealSpring(REVEAL.tornNote)}
                    className={styles.tornNoteInner}
                  >
                    <TornNoteGroup />
                  </motion.div>
                </PreviewTarget>

                <motion.div
                  className={`${styles.ticketRevealLayer} ${styles.ticketRevealLayerBg}`}
                  initial={ticketSlideReveal.initial}
                  animate={{ ...ticketSlideReveal.animate, opacity: ticketHidden ? 0 : 1 }}
                  transition={revealSpring(REVEAL.ticket)}
                >
                  <img
                    className={styles.ticketBg}
                    src={assets.goldTicketTilt}
                    alt=""
                    aria-hidden
                    draggable={false}
                  />
                </motion.div>

                <img
                  className={styles.envelope}
                  src={assets.envelopeOpen}
                  alt="Open invitation envelope"
                  draggable={false}
                />

                <motion.div
                  className={`${styles.ticketRevealLayer} ${styles.ticketRevealLayerText}`}
                  initial={ticketSlideReveal.initial}
                  animate={{ ...ticketSlideReveal.animate, opacity: ticketHidden ? 0 : 1 }}
                  transition={revealSpring(REVEAL.ticket)}
                >
                  <div className={styles.ticketText}>
                    <span className={styles.saveWord}>Save</span>
                    <span className={styles.theWord}>the</span>
                    <span className={styles.dateWord}>Date</span>
                    <span className={styles.saveDateNum}>{invitation.saveTheDate}</span>
                  </div>
                </motion.div>

                <motion.div
                  className={`${styles.ticketRevealLayer} ${styles.ticketRevealLayerText}`}
                  aria-hidden
                  initial={ticketSlideReveal.initial}
                  animate={{ ...ticketSlideReveal.animate, opacity: ticketHidden ? 0 : 1 }}
                  transition={revealSpring(REVEAL.ticket)}
                >
                  <div className={styles.ticketSideNames}>
                    <p className={styles.ticketSideNamesText}>
                      {invitation.groom} & {invitation.bride}
                    </p>
                  </div>
                </motion.div>

                <PreviewTarget
                  id="goldTicket"
                  selectedItem={selectedItem}
                  onSelect={handleSelect}
                  className={styles.ticketPreviewAnchor}
                  ariaLabel="View save the date ticket"
                >
                  <div className={styles.ticketGroupSource}>
                    <TicketGroup />
                  </div>
                </PreviewTarget>

                <img
                  className={styles.waxSeal}
                  src={assets.waxSealCenter}
                  alt=""
                  aria-hidden
                  draggable={false}
                />

                <p className={styles.envelopeCoupleNames} aria-hidden>
                  {invitation.groom}{' '}
                  <span className={styles.envelopeCoupleAmp}>&amp;</span>{' '}
                  {invitation.bride}
                </p>

                <motion.img
                  className={styles.envelopeBottomFloral}
                  src={assets.envelopeBottomFloral}
                  alt=""
                  aria-hidden
                  draggable={false}
                  initial={{ opacity: 0, y: 36, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={revealSpring(REVEAL.frontFlowers)}
                />
              </div>
            </div>
          </div>

          <motion.footer
            className={styles.belowEnvelope}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={revealTransition(REVEAL.frontFlowers + 0.35, 0.9)}
          >
            <p className={styles.belowEnvelopeNames}>
              {invitation.groom}{' '}
              <span className={styles.belowEnvelopeAmp}>&amp;</span>{' '}
              {invitation.bride}
            </p>
            <p className={styles.belowEnvelopeDate}>{invitation.dateShort}</p>
            <p className={styles.belowEnvelopeJoin}>{invitation.joinUsMessage}</p>
          </motion.footer>

          <button
            type="button"
            className={styles.returnToEnvelope}
            onClick={onClose}
            disabled={disabled}
          >
            {invitation.returnToEnvelope}
          </button>
        </div>
      </motion.div>
    </LayoutGroup>
  )
}
