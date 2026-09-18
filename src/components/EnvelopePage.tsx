import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { assets } from '../data/invitation'
import { useInvitation } from '../invitation/InvitationContext'
import {
  isInvitationAudioUnlocked,
  unlockInvitationAudio,
} from '../lib/audio'
import { luxuryEase, revealSpring } from './invitationReveal'
import { TapIndicator } from './TapIndicator'
import styles from './EnvelopePage.module.css'

interface EnvelopePageProps {
  onOpen: () => void
  disabled?: boolean
  exiting?: boolean
  skipIntro?: boolean
}

const INTRO = {
  names: { delay: 0, duration: 1.2 },
  date: { delay: 0.6, duration: 0.9 },
  subtitle: { delay: 1.5, duration: 0.9 },
  envelope: { delay: 2.3 },
  instruction: { delay: 3.1, duration: 0.8 },
} as const

const INTRO_READY_MS = 3800
const AUTO_OPEN_MS = 5000

export function EnvelopePage({ onOpen, disabled, exiting, skipIntro }: EnvelopePageProps) {
  const { content, locale, t } = useInvitation()
  const reduceMotion = useReducedMotion()
  const [introReady, setIntroReady] = useState(!!skipIntro)
  const [envelopeSettled, setEnvelopeSettled] = useState(!!skipIntro)
  const [opening, setOpening] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [audioReady, setAudioReady] = useState(() => isInvitationAudioUnlocked())
  const openedRef = useRef(false)

  useEffect(() => {
    if (skipIntro) return
    const readyTimer = window.setTimeout(() => setIntroReady(true), INTRO_READY_MS)
    const settledTimer = window.setTimeout(
      () => setEnvelopeSettled(true),
      INTRO.envelope.delay * 1000 + 900,
    )
    return () => {
      window.clearTimeout(readyTimer)
      window.clearTimeout(settledTimer)
    }
  }, [skipIntro])

  /* Browsers block timed audio unless we unlock during a real gesture first. */
  useEffect(() => {
    if (audioReady) return

    const unlock = () => {
      unlockInvitationAudio()
      setAudioReady(true)
    }

    window.addEventListener('pointerdown', unlock, { once: true, capture: true })
    window.addEventListener('keydown', unlock, { once: true, capture: true })
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true })
      window.removeEventListener('keydown', unlock, { capture: true })
    }
  }, [audioReady])

  const openInvitation = useCallback(() => {
    if (openedRef.current || disabled || !introReady) return
    openedRef.current = true
    setOpening(true)
    setCountdown(null)
    onOpen()
  }, [disabled, introReady, onOpen])

  useEffect(() => {
    // Auto-open only after a user gesture unlocked audio — otherwise SFX/piano are muted.
    if (!introReady || !audioReady || exiting || disabled || openedRef.current) {
      setCountdown(null)
      return
    }

    const totalSeconds = Math.ceil(AUTO_OPEN_MS / 1000)
    setCountdown(totalSeconds)
    const startedAt = performance.now()

    const tick = window.setInterval(() => {
      const elapsed = performance.now() - startedAt
      const remaining = Math.max(0, Math.ceil((AUTO_OPEN_MS - elapsed) / 1000))
      setCountdown(remaining > 0 ? remaining : null)
      if (elapsed >= AUTO_OPEN_MS) {
        window.clearInterval(tick)
        openInvitation()
      }
    }, 100)

    return () => window.clearInterval(tick)
  }, [introReady, audioReady, exiting, disabled, openInvitation])

  const interactionLocked = disabled || !introReady || opening
  const hintActive = introReady && !exiting && !disabled && !opening

  const fadeUp = (delay: number, duration: number) => ({
    initial: skipIntro ? false : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: skipIntro
      ? { duration: 0 }
      : { delay, duration, ease: luxuryEase },
  })

  const floatY = !reduceMotion && envelopeSettled && !exiting ? [0, -5, 0] : 0

  return (
    <motion.section
      className={styles.page}
      initial={{ opacity: 0 }}
      animate={{ opacity: exiting ? 0 : 1, scale: exiting ? 0.98 : 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.55, ease: luxuryEase }}
    >
      <header className={styles.introHeader}>
        {content.guestName && (
          <motion.p className={styles.guestName} {...fadeUp(0, 0.8)}>
            {content.guestName}
          </motion.p>
        )}

        {content.inviteLead && (
          <motion.p
            className={`${styles.inviteLead} ${locale === 'AR' ? styles.inviteLeadArabic : ''}`}
            dir={locale === 'AR' || locale === 'HE' ? 'rtl' : 'ltr'}
            {...fadeUp(0.25, 0.85)}
          >
            {content.inviteLead}
          </motion.p>
        )}

        <motion.h1 className={styles.names} {...fadeUp(INTRO.names.delay, INTRO.names.duration)}>
          {content.groom.toUpperCase()} &amp; {content.bride.toUpperCase()}
        </motion.h1>

        <motion.p className={styles.date} {...fadeUp(INTRO.date.delay, INTRO.date.duration)}>
          {content.saveTheDate}
        </motion.p>
      </header>

      <button
        type="button"
        className={styles.hitArea}
        onClick={openInvitation}
        disabled={interactionLocked}
        aria-label={t('tapToOpen')}
      >
        <div className={styles.envelopeGlow} aria-hidden />

        <motion.div
          className={styles.stage}
          initial={skipIntro ? false : { opacity: 0, y: 40 }}
          animate={{
            opacity: 1,
            y: floatY,
          }}
          transition={
            skipIntro
              ? {
                  y: reduceMotion
                    ? { duration: 0 }
                    : { duration: 4.5, repeat: Infinity, ease: 'easeInOut' },
                }
              : {
                  opacity: { delay: INTRO.envelope.delay, duration: 0.6, ease: luxuryEase },
                  y: envelopeSettled
                    ? reduceMotion
                      ? { duration: 0 }
                      : { duration: 4.5, repeat: Infinity, ease: 'easeInOut' }
                    : { delay: INTRO.envelope.delay, ...revealSpring(0) },
                }
          }
        >
          <img
            className={styles.envelope}
            src={assets.envelope}
            alt="Closed invitation envelope"
            draggable={false}
          />

          <p
            className={`${styles.tagline} ${locale === 'AR' ? styles.taglineArabic : ''}`}
            dir={locale === 'AR' ? 'rtl' : undefined}
            lang={locale === 'AR' ? 'ar' : undefined}
          >
            {content.tagline.split('\n').map((line, i) => (
              <Fragment key={line}>
                {i > 0 && <br />}
                <span className={styles.taglineLine}>{line}</span>
              </Fragment>
            ))}
          </p>

          <TapIndicator active={hintActive} />

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
        </motion.div>
      </button>

      <motion.div
        className={styles.tapFooter}
        initial={skipIntro ? false : { opacity: 0 }}
        animate={{ opacity: hintActive ? 1 : 0 }}
        transition={
          skipIntro
            ? { duration: 0.35, ease: luxuryEase }
            : {
                delay: hintActive ? INTRO.instruction.delay : 0,
                duration: hintActive ? INTRO.instruction.duration : 0.35,
                ease: luxuryEase,
              }
        }
      >
        <p
          className={`${styles.tapBottom} ${locale === 'AR' ? styles.tapBottomArabic : ''} ${locale === 'HE' ? styles.tapBottomHebrew : ''}`}
          dir={locale === 'AR' || locale === 'HE' ? 'rtl' : 'ltr'}
        >
          {t('tapToOpen')}
        </p>
        {countdown != null && countdown > 0 && (
          <p className={styles.countdown} aria-live="polite">
            {countdown}
          </p>
        )}
      </motion.div>
    </motion.section>
  )
}
