import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import {
  playEnvelopeOpen,
  preloadInvitationAudio,
  stopInvitationAudio,
  unlockInvitationAudio,
} from '../lib/audio'
import { EnvelopePage } from './EnvelopePage'
import { InvitationHero } from './InvitationHero'
import styles from './OpeningExperience.module.css'

export function OpeningExperience() {
  const [isOpen, setIsOpen] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    preloadInvitationAudio()
  }, [])

  const handleOpen = useCallback(() => {
    if (isOpen || isAnimating) return
    unlockInvitationAudio()
    playEnvelopeOpen()
    setIsAnimating(true)
    setTimeout(() => {
      setIsOpen(true)
      setIsAnimating(false)
    }, 520)
  }, [isOpen, isAnimating])

  const handleClose = useCallback(() => {
    if (!isOpen || isAnimating) return
    stopInvitationAudio()
    setIsAnimating(true)
    setIsOpen(false)
    setTimeout(() => setIsAnimating(false), 520)
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
          <InvitationHero key="hero" onClose={handleClose} disabled={isAnimating} />
        )}
      </AnimatePresence>
    </div>
  )
}
