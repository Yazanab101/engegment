import { motion } from 'framer-motion'
import styles from './TapIndicator.module.css'

export function TapIndicator() {
  return (
    <motion.p
      className={styles.label}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.8, duration: 1 }}
    >
      Tap envelope to open
    </motion.p>
  )
}
