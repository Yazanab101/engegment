import { motion } from 'framer-motion'
import { invitation } from '../data/invitation'
import styles from './InvitationContent.module.css'

interface InvitationContentProps {
  visible: boolean
}

export function InvitationContent({ visible }: InvitationContentProps) {
  if (!visible) return null

  return (
    <motion.article
      className={styles.card}
      initial={{ opacity: 0, y: 60, scale: 0.88, rotateX: 12 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
      transition={{
        duration: 1.2,
        delay: 0.2,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
    >
      <div className={styles.border}>
        <header className={styles.header}>
          <motion.p
            className={styles.eyebrow}
            initial={{ opacity: 0, letterSpacing: '0.1em' }}
            animate={{ opacity: 1, letterSpacing: '0.4em' }}
            transition={{ delay: 0.6, duration: 1 }}
          >
            Engagement Celebration
          </motion.p>

          <motion.div
            className={styles.names}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75, duration: 0.9 }}
          >
            <h1 className={styles.name}>{invitation.bride}</h1>
            <span className={styles.ampersand}>&amp;</span>
            <h1 className={styles.name}>{invitation.groom}</h1>
          </motion.div>

          <motion.div
            className={styles.divider}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: 0.95, duration: 0.8 }}
          />
        </header>

        <motion.p
          className={styles.message}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1, duration: 0.8 }}
        >
          {invitation.message}
        </motion.p>

        <motion.div
          className={styles.details}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.25, duration: 0.8 }}
        >
          <div className={styles.detailBlock}>
            <span className={styles.detailLabel}>Date</span>
            <p className={styles.detailValue}>{invitation.date}</p>
            <p className={styles.detailSub}>{invitation.time}</p>
          </div>
          <div className={styles.detailBlock}>
            <span className={styles.detailLabel}>Venue</span>
            <p className={styles.detailValue}>{invitation.venue}</p>
            <p className={styles.detailSub}>{invitation.address}</p>
          </div>
        </motion.div>

        <motion.div
          className={styles.photos}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
        >
          {invitation.photos.map((photo, i) => (
            <motion.figure
              key={photo.src}
              className={styles.photoFrame}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.6 + i * 0.15, duration: 0.7 }}
            >
              <img src={photo.src} alt={photo.alt} loading="lazy" />
            </motion.figure>
          ))}
        </motion.div>

        <motion.p
          className={styles.footer}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.1, duration: 0.8 }}
        >
          With love, we await your presence
        </motion.p>
      </div>
    </motion.article>
  )
}
