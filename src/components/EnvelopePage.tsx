import { Fragment, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { assets, invitation } from '../data/invitation'
import { luxuryEase, revealSpring } from './invitationReveal'
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

export function EnvelopePage({ onOpen, disabled, exiting, skipIntro }: EnvelopePageProps) {
  const [introReady, setIntroReady] = useState(!!skipIntro)
  const [envelopeSettled, setEnvelopeSettled] = useState(!!skipIntro)

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

  const interactionLocked = disabled || !introReady

  const fadeUp = (delay: number, duration: number) => ({
    initial: skipIntro ? false : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: skipIntro
      ? { duration: 0 }
      : { delay, duration, ease: luxuryEase },
  })

  return (
    <motion.section
      className={styles.page}
      initial={{ opacity: 0 }}
      animate={{ opacity: exiting ? 0 : 1, scale: exiting ? 0.98 : 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.55, ease: luxuryEase }}
    >
      <header className={styles.introHeader}>
        <motion.h1 className={styles.names} {...fadeUp(INTRO.names.delay, INTRO.names.duration)}>
          {invitation.groom.toUpperCase()} &amp; {invitation.bride.toUpperCase()}
        </motion.h1>

        <motion.p className={styles.date} {...fadeUp(INTRO.date.delay, INTRO.date.duration)}>
          {invitation.saveTheDate}
        </motion.p>

        <motion.p
          className={styles.subtitle}
          {...fadeUp(INTRO.subtitle.delay, INTRO.subtitle.duration)}
        >
          {invitation.joinUsMessage}
        </motion.p>
      </header>

      <button
        type="button"
        className={styles.hitArea}
        onClick={onOpen}
        disabled={interactionLocked}
        aria-label="Tap envelope to open"
      >
        <div className={styles.envelopeGlow} aria-hidden />

        <motion.div
          className={styles.stage}
          initial={skipIntro ? false : { opacity: 0, y: 40 }}
          animate={{
            opacity: 1,
            y: envelopeSettled && !exiting ? [0, -5, 0] : 0,
          }}
          transition={
            skipIntro
              ? {
                  y: { duration: 4.5, repeat: Infinity, ease: 'easeInOut' },
                }
              : {
                  opacity: { delay: INTRO.envelope.delay, duration: 0.6, ease: luxuryEase },
                  y: envelopeSettled
                    ? { duration: 4.5, repeat: Infinity, ease: 'easeInOut' }
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
        </motion.div>
      </button>

      <motion.p
        className={styles.tapBottom}
        initial={skipIntro ? false : { opacity: 0 }}
        animate={{ opacity: introReady ? 1 : 0 }}
        transition={
          skipIntro
            ? { duration: 0 }
            : { delay: INTRO.instruction.delay, duration: INTRO.instruction.duration, ease: luxuryEase }
        }
      >
        Tap Envelope To Open
      </motion.p>
    </motion.section>
  )
}
