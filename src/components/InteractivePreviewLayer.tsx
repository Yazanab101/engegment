import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { assets, invitation } from '../data/invitation'
import {
  type PreviewItemId,
  previewEase,
  previewLayoutId,
  previewTransition,
} from './collagePreview'
import heroStyles from './InvitationHero.module.css'
import styles from './InteractivePreviewLayer.module.css'

interface InteractivePreviewLayerProps {
  selectedItem: PreviewItemId | null
  onClose: () => void
}

function TicketGroup({ enlarged = false }: { enlarged?: boolean }) {
  const textWrapClass = enlarged ? styles.previewTicketText : heroStyles.ticketText
  const sideClass = enlarged ? styles.previewTicketSideNames : heroStyles.ticketSideNames
  const sideTextClass = enlarged ? styles.previewTicketSideNamesText : heroStyles.ticketSideNamesText

  return (
    <div className={enlarged ? styles.previewTicketInner : styles.ticketGroupInner}>
      <div className={enlarged ? styles.previewTicketRelative : styles.ticketGroupRelative}>
        <img
          className={enlarged ? styles.previewTicketBg : heroStyles.ticketBg}
          src={assets.goldTicketTilt}
          alt=""
          aria-hidden
          draggable={false}
        />
        <div className={textWrapClass}>
          <span className={heroStyles.saveWord}>Save</span>
          <span className={heroStyles.theWord}>the</span>
          <span className={heroStyles.dateWord}>Date</span>
          <span className={heroStyles.saveDateNum}>{invitation.saveTheDate}</span>
        </div>
        <div className={sideClass}>
          <p className={sideTextClass}>
            {invitation.groom} & {invitation.bride}
          </p>
        </div>
      </div>
    </div>
  )
}

function TornNoteGroup({ enlarged = false }: { enlarged?: boolean }) {
  const noteText = (
    <p className={enlarged ? styles.previewTornNoteText : heroStyles.tornNoteText}>
      <span className={enlarged ? styles.previewTornNoteLines : heroStyles.tornNoteLines}>
        {invitation.celebrationNote.split('\n').map((line, i) => (
          <span key={line}>
            {i > 0 && <br />}
            {line}
          </span>
        ))}
      </span>
      <span className={enlarged ? styles.previewTornNoteHeart : heroStyles.tornNoteHeart}>
        ♥
      </span>
    </p>
  )

  if (enlarged) {
    return (
      <div className={styles.previewTornNote}>
        <img
          className={styles.previewTornNoteImg}
          src={assets.tornNoteRight}
          alt=""
          draggable={false}
        />
        {noteText}
      </div>
    )
  }

  return (
    <>
      <img
        className={heroStyles.tornNote}
        src={assets.tornNoteRight}
        alt=""
        draggable={false}
      />
      {noteText}
    </>
  )
}

function PreviewContent({ id }: { id: PreviewItemId }) {
  switch (id) {
    case 'largePhoto':
      return (
        <img
          className={styles.previewPhoto}
          src={assets.couplePhotoTicketBg}
          alt="Couple photo"
          draggable={false}
        />
      )

    case 'smallPhoto':
      return (
        <img
          className={`${styles.previewPhoto} ${styles.previewPhotoSmall}`}
          src={assets.couplePhotoBw}
          alt="Black and white couple photo"
          draggable={false}
        />
      )

    case 'tornNote':
      return <TornNoteGroup enlarged />

    case 'goldTicket':
      return (
        <div className={styles.previewTicket}>
          <TicketGroup enlarged />
        </div>
      )

    default:
      return null
  }
}

export function InteractivePreviewLayer({ selectedItem, onClose }: InteractivePreviewLayerProps) {
  useEffect(() => {
    if (!selectedItem) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [selectedItem, onClose])

  return (
    <AnimatePresence>
      {selectedItem && (
        <>
          <motion.button
            type="button"
            className={styles.backdrop}
            aria-label="Close preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: previewEase }}
            onClick={onClose}
          />

          <div className={styles.overlay} aria-modal="true" role="dialog">
            <motion.div
              layoutId={previewLayoutId(selectedItem)}
              className={styles.previewFrame}
              transition={previewTransition}
              onClick={(event) => event.stopPropagation()}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={previewTransition}
              >
                <PreviewContent id={selectedItem} />
              </motion.div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

interface PreviewTargetProps {
  id: PreviewItemId
  selectedItem: PreviewItemId | null
  onSelect: (id: PreviewItemId) => void
  className?: string
  ariaLabel: string
  children: ReactNode
}

export function PreviewTarget({
  id,
  selectedItem,
  onSelect,
  className,
  ariaLabel,
  children,
}: PreviewTargetProps) {
  const isSelected = selectedItem === id

  return (
    <motion.div
      layoutId={previewLayoutId(id)}
      className={className}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-expanded={isSelected}
      onPointerUp={(event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return
        event.stopPropagation()
        if (!isSelected) onSelect(id)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          if (!isSelected) onSelect(id)
        }
      }}
      style={{
        pointerEvents: isSelected ? 'none' : 'auto',
        cursor: isSelected ? 'default' : 'pointer',
        opacity: isSelected ? 0 : 1,
      }}
      transition={previewTransition}
      whileTap={{ scale: isSelected ? 1 : 0.98 }}
    >
      {children}
    </motion.div>
  )
}

export { TicketGroup, TornNoteGroup }
