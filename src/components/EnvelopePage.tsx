import { Fragment } from 'react'
import { motion } from 'framer-motion'
import { assets, invitation } from '../data/invitation'
import styles from './EnvelopePage.module.css'

interface EnvelopePageProps {
  onOpen: () => void
  disabled?: boolean
  exiting?: boolean
}

export function EnvelopePage({ onOpen, disabled, exiting }: EnvelopePageProps) {
  return (
    <motion.section
      className={styles.page}
      initial={{ opacity: 0 }}
      animate={{ opacity: exiting ? 0 : 1, scale: exiting ? 0.98 : 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
    >
      <button
        type="button"
        className={styles.hitArea}
        onClick={onOpen}
        disabled={disabled}
        aria-label="Tap envelope to open"
      >
        <div className={styles.stage}>
          <img
            className={styles.envelope}
            src={assets.envelope}
            alt="Closed invitation envelope"
            draggable={false}
          />

          <p className={styles.tagline}>
            {invitation.tagline.split('\n').map((line, i) => (
              <Fragment key={line}>
                {i > 0 && <br />}
                <span className={styles.taglineLine}>{line}</span>
              </Fragment>
            ))}
          </p>

          <img
            className={styles.floralLeft}
            src={assets.floralLeft}
            alt=""
            aria-hidden
            draggable={false}
          />

          <img
            className={styles.floralRight}
            src={assets.floralRight}
            alt=""
            aria-hidden
            draggable={false}
          />
        </div>
      </button>

      <p className={styles.tapBottom}>Tap envelope to Open</p>
    </motion.section>
  )
}
