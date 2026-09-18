import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import {
  keepEngagementPianoArmed,
  playEnvelopeOpen,
  preloadInvitationAudio,
  stopInvitationAudio,
  unlockInvitationAudio,
} from '../lib/audio'
import { assets } from '../data/invitation'
import { EnvelopePage } from './EnvelopePage'
import { InvitationHero } from './InvitationHero'
import { useInvitation } from '../invitation/InvitationContext'
import styles from './OpeningExperience.module.css'

export function OpeningExperience() {
  const { rtl } = useInvitation()
  const [hasSeenIntro, setHasSeenIntro] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    preloadInvitationAudio()
    const img = new Image()
    img.src = assets.envelope
  }, [])

  useEffect(() => {
    document.documentElement.dir = rtl ? 'rtl' : 'ltr'
    document.documentElement.lang = rtl ? (document.documentElement.lang || 'ar') : 'en'
  }, [rtl])

  const handleOpen = useCallback(() => {
    if (isOpen || isAnimating) return
    unlockInvitationAudio()
    keepEngagementPianoArmed()
    playEnvelopeOpen()
    setHasSeenIntro(true)
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
            skipIntro={hasSeenIntro}
          />
        ) : (
          <InvitationHero key="hero" onClose={handleClose} disabled={isAnimating} />
        )}
      </AnimatePresence>
    </div>
  )
}
