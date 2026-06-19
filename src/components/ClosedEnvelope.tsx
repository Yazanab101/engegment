import { motion } from 'framer-motion'
import { invitation } from '../data/invitation'
import { FloralAccent } from './FloralAccent'
import { WaxSeal } from './WaxSeal'
import styles from './ClosedEnvelope.module.css'

type EnvelopePhase = 'closed' | 'flap-opening' | 'card-sliding' | 'envelope-fading'

interface ClosedEnvelopeProps {
  phase: EnvelopePhase
  onTap: () => void
  disabled: boolean
}

export function ClosedEnvelope({ phase, onTap, disabled }: ClosedEnvelopeProps) {
  const flapOpen = phase !== 'closed'
  const cardSliding = phase === 'card-sliding' || phase === 'envelope-fading'
  const envelopeFading = phase === 'envelope-fading'

  return (
    <button
      type="button"
      className={styles.trigger}
      onClick={onTap}
      disabled={disabled}
      aria-label="Open invitation envelope"
    >
      <motion.div
        className={styles.wrapper}
        animate={{
          opacity: envelopeFading ? 0 : 1,
          scale: envelopeFading ? 0.97 : 1,
          y: envelopeFading ? 24 : 0,
        }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      >
        <FloralAccent position="top-left" />

        <div className={styles.envelopeScene}>
          <div className={styles.body}>
            <div className={styles.paperTexture} aria-hidden />

            <motion.div
              className={styles.innerCard}
              animate={{
                y: cardSliding ? -88 : 4,
              }}
              transition={{
                duration: 1.05,
                delay: cardSliding ? 0.12 : 0,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <div className={styles.paperTexture} aria-hidden />
            </motion.div>

            <div className={styles.sideShadowLeft} aria-hidden />
            <div className={styles.sideShadowRight} aria-hidden />
          </div>

          <motion.div
            className={styles.flapWrap}
            animate={{ rotateX: flapOpen ? 168 : 0 }}
            transition={{ duration: 0.95, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={styles.flap}>
              <div className={styles.paperTexture} aria-hidden />
              <p className={styles.monogram}>
                {invitation.bride[0]}
                <span className={styles.monogramDot} aria-hidden>
                  ·
                </span>
                {invitation.groom[0]}
              </p>
            </div>
          </motion.div>

          <motion.div
            className={styles.sealWrap}
            animate={{
              opacity: flapOpen ? 0 : 1,
              scale: flapOpen ? 0.72 : 1,
            }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <WaxSeal size={52} />
          </motion.div>
        </div>

        <FloralAccent position="bottom-right" />

        <div className={styles.shadowLayer} aria-hidden />
        <div className={styles.shadowLayerSoft} aria-hidden />
      </motion.div>
    </button>
  )
}
