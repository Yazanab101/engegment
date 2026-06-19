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
      <div className={styles.envelopeWrap}>
        <img
          className={styles.envelopeInterior}
          src={assets.envelopeInterior}
          alt=""
          aria-hidden
          draggable={false}
        />

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

        <img
          className={styles.waxSeal}
          src={assets.waxSealCenter}
          alt=""
          aria-hidden
          draggable={false}
        />
      </div>
    </motion.div>
  )
}
