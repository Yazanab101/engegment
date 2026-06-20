import { motion } from 'framer-motion'
import { assets, invitation } from '../data/invitation'
import {
  REVEAL,
  revealSpring,
  revealTransition,
  slideUpReveal,
  ticketSlideReveal,
} from './invitationReveal'
import styles from './InvitationHero.module.css'

export function InvitationHero() {
  return (
    <motion.div
      className={styles.page}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className={styles.canvas}>
        <div className={styles.envelopeWrap}>
          <div className={styles.envelopeStack}>
            <div className={styles.envelopeScale}>
              {/* Envelope back — fades in first, no movement */}
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

              {/* Top flowers — behind photos */}
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

              {/* Inserted items — slide up from inside the envelope */}
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

              <motion.div
                className={styles.tornNoteBlock}
                aria-hidden
                initial={{ opacity: 0, x: -32, y: 120, scale: 0.96, rotate: 7 }}
                animate={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: 7 }}
                transition={revealSpring(REVEAL.tornNote)}
              >
                <img
                  className={styles.tornNote}
                  src={assets.tornNoteRight}
                  alt=""
                  draggable={false}
                />
                <p className={styles.tornNoteText}>
                  <span className={styles.tornNoteLines}>
                    {invitation.celebrationNote.split('\n').map((line, i) => (
                      <span key={line}>
                        {i > 0 && <br />}
                        {line}
                      </span>
                    ))}
                  </span>
                  <span className={styles.tornNoteHeart}>♥</span>
                </p>
              </motion.div>

              <motion.div
                className={`${styles.ticketRevealLayer} ${styles.ticketRevealLayerBg}`}
                initial={ticketSlideReveal.initial}
                animate={ticketSlideReveal.animate}
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

              {/* Envelope front — fixed, no reveal motion */}
              <img
                className={styles.envelope}
                src={assets.envelopeOpen}
                alt="Open invitation envelope"
                draggable={false}
              />

              <motion.div
                className={`${styles.ticketRevealLayer} ${styles.ticketRevealLayerText}`}
                initial={ticketSlideReveal.initial}
                animate={ticketSlideReveal.animate}
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
                animate={ticketSlideReveal.animate}
                transition={revealSpring(REVEAL.ticket)}
              >
                <div className={styles.ticketSideNames}>
                  <p className={styles.ticketSideNamesText}>
                    {invitation.groom} & {invitation.bride}
                  </p>
                </div>
              </motion.div>

              {/* Wax seal — fixed, no reveal motion */}
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

              {/* Front flowers — on top of ticket/envelope */}
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
      </div>
    </motion.div>
  )
}
