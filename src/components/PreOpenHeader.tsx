import { motion } from 'framer-motion'
import { invitation } from '../data/invitation'
import styles from './PreOpenHeader.module.css'

export function PreOpenHeader() {
  return (
    <motion.header
      className={styles.header}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.2, ease: 'easeOut' }}
    >
      <p className={styles.overline}>Engagement</p>

      <div className={styles.namesBlock}>
        <h1 className={styles.name}>{invitation.bride}</h1>
        <span className={styles.conjunction} aria-hidden>
          &amp;
        </span>
        <h1 className={styles.name}>{invitation.groom}</h1>
      </div>

      <div className={styles.rule} aria-hidden />

      <p className={styles.date}>{invitation.dateShort.replace(/\./g, ' · ')}</p>
    </motion.header>
  )
}
