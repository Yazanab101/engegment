import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import styles from './TapIndicator.module.css'

interface TapIndicatorProps {
  active: boolean
}

const TAP_CYCLES = 7
const CYCLE_MS = 950
const HOLD_AFTER_MS = 800
const FADE_OUT_MS = 700

export function TapIndicator({ active }: TapIndicatorProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!active) {
      setVisible(false)
      return
    }

    setVisible(true)
    const hideAfter = TAP_CYCLES * CYCLE_MS + HOLD_AFTER_MS + FADE_OUT_MS
    const timer = window.setTimeout(() => setVisible(false), hideAfter)
    return () => window.clearTimeout(timer)
  }, [active])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={styles.hint}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          aria-hidden
        >
          <motion.span
            className={styles.pulse}
            animate={{
              scale: [0.85, 1.7],
              opacity: [0.55, 0],
            }}
            transition={{
              duration: CYCLE_MS / 1000,
              repeat: TAP_CYCLES - 1,
              ease: 'easeOut',
              times: [0.4, 1],
            }}
          />

          <motion.span
            className={styles.finger}
            animate={{
              y: [18, 0, 0, 18],
              scale: [1, 0.88, 0.88, 1],
            }}
            transition={{
              duration: CYCLE_MS / 1000,
              repeat: TAP_CYCLES - 1,
              ease: [0.4, 0, 0.2, 1],
              times: [0, 0.38, 0.55, 1],
            }}
          >
            👆🏻
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
