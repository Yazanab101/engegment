import { motion } from 'framer-motion'
import { useMemo } from 'react'
import styles from './Particles.module.css'

interface ParticlesProps {
  active: boolean
}

export function Particles({ active }: ParticlesProps) {
  const particles = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 320,
        y: (Math.random() - 0.5) * 280,
        size: 2 + Math.random() * 5,
        delay: Math.random() * 0.4,
        duration: 1.2 + Math.random() * 1.2,
      })),
    [],
  )

  if (!active) return null

  return (
    <div className={styles.container} aria-hidden>
      <motion.div
        className={styles.glow}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: [0, 0.45, 0.15], scale: [0.5, 1.6, 2] }}
        transition={{ duration: 2, ease: 'easeOut' }}
      />
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className={styles.particle}
          style={{
            width: p.size,
            height: p.size,
          }}
          initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
          animate={{
            opacity: [0, 1, 0],
            x: p.x,
            y: p.y,
            scale: [0, 1, 0.3],
          }}
          transition={{
            duration: p.duration,
            delay: 0.3 + p.delay,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  )
}
