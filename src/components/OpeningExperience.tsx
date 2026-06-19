import { useCallback, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { EnvelopePage } from './EnvelopePage'
import { InvitationHero } from './InvitationHero'
import styles from './OpeningExperience.module.css'

export function OpeningExperience() {
  const [isOpen, setIsOpen] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  const handleOpen = useCallback(() => {
    if (isOpen || isAnimating) return
    setIsAnimating(true)
    setTimeout(() => {
      setIsOpen(true)
      setIsAnimating(false)
    }, 520)
  }, [isOpen, isAnimating])

  return (
    <div className={styles.root}>
      <AnimatePresence mode="wait">
        {!isOpen ? (
          <EnvelopePage
            key="envelope"
            onOpen={handleOpen}
            disabled={isAnimating}
            exiting={isAnimating}
          />
        ) : (
          <InvitationHero key="hero" />
        )}
      </AnimatePresence>
    </div>
  )
}
