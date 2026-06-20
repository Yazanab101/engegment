import { motion } from 'framer-motion'
import { assets, invitation } from '../data/invitation'
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
              <img
                className={styles.envelopeInterior}
                src={assets.envelopeInterior}
                alt=""
                aria-hidden
                draggable={false}
              />

              <img
                className={styles.floralBehindLeft}
                src={assets.floralBottomLeft}
                alt=""
                aria-hidden
                draggable={false}
              />

              <img
                className={styles.floralBehindRight}
                src={assets.floralBottomLeft}
                alt=""
                aria-hidden
                draggable={false}
              />

              <img
                className={styles.couplePhotoBw}
                src={assets.couplePhotoBw}
                alt=""
                aria-hidden
                draggable={false}
              />

              <img
                className={styles.couplePhoto}
                src={assets.couplePhotoTicketBg}
                alt=""
                aria-hidden
                draggable={false}
              />

              <div className={styles.tornNoteBlock} aria-hidden>
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
              </div>

              <img
                className={styles.ticketBg}
                src={assets.goldTicketTilt}
                alt=""
                aria-hidden
                draggable={false}
              />

              <img
                className={styles.envelope}
                src={assets.envelopeOpen}
                alt="Open invitation envelope"
                draggable={false}
              />

              <div className={styles.ticketText}>
                <span className={styles.saveWord}>Save</span>
                <span className={styles.theWord}>the</span>
                <span className={styles.dateWord}>Date</span>
                <span className={styles.saveDateNum}>{invitation.saveTheDate}</span>
              </div>

              <div className={styles.ticketSideNames} aria-hidden>
                <span className={styles.ticketSideNamesText}>
                  {invitation.groom} & {invitation.bride}
                </span>
              </div>

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

              <img
                className={styles.envelopeBottomFloral}
                src={assets.envelopeBottomFloral}
                alt=""
                aria-hidden
                draggable={false}
              />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
