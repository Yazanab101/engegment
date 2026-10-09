import { useEffect, useId, useRef, useState } from 'react'
import type { GuestCopy } from './guest-copy'
import type { MomentsLang } from './couple-headline'

function submissionKey() {
  const key = 'lead.submission.id'
  try {
    const existing = sessionStorage.getItem(key)
    if (existing) return existing
    const id = crypto.randomUUID()
    sessionStorage.setItem(key, id)
    return id
  } catch {
    return crypto.randomUUID()
  }
}

function validPhone(raw: string) {
  const digits = raw.replace(/\D/g, '')
  return digits.length >= 8 && digits.length <= 15
}

export function LeadPopup({
  open,
  copy,
  lang,
  dir,
  onClose,
}: {
  open: boolean
  copy: GuestCopy
  lang: MomentsLang
  dir: 'rtl' | 'ltr'
  onClose: () => void
}) {
  const titleId = useId()
  const nameRef = useRef<HTMLInputElement>(null)
  const sending = useRef(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [company, setCompany] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setDone(false)
    setError('')
    sending.current = false
    requestAnimationFrame(() => nameRef.current?.focus())
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const submit = async () => {
    if (sending.current || busy) return
    setError('')
    if (!name.trim()) {
      setError(copy.leadNameRequired)
      return
    }
    if (!validPhone(phone)) {
      setError(copy.leadPhoneRequired)
      return
    }
    sending.current = true
    setBusy(true)
    try {
      const res = await fetch('/api/guest-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: submissionKey(),
          name: name.trim(),
          phone: phone.trim(),
          notes: notes.trim() || null,
          company,
          preferredLanguage: lang,
          source: 'moments_guest',
          landingPath: '/moments',
        }),
      })
      if (!res.ok) {
        sending.current = false
        setError(copy.leadError)
        return
      }
      try {
        sessionStorage.removeItem('lead.submission.id')
      } catch {
        /* ignore */
      }
      setDone(true)
    } catch {
      sending.current = false
      setError(copy.leadError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button className="moments-overlay" type="button" aria-label={copy.close} onClick={onClose} />
      <div className="moments-sheet" dir={dir} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        {done ? (
          <div style={{ textAlign: 'center' }}>
            <h3 id={titleId}>{copy.leadThanksTitle}</h3>
            <p className="moments-muted" style={{ marginTop: '0.7rem' }}>
              {copy.leadThanksBody}
            </p>
            <button className="moments-btn" style={{ marginTop: '1.2rem' }} type="button" onClick={onClose}>
              {copy.close}
            </button>
          </div>
        ) : (
          <>
            <h3 id={titleId}>{copy.leadTitle}</h3>
            <p className="moments-muted" style={{ marginTop: '0.45rem' }}>
              {copy.leadBody}
            </p>
            {error ? (
              <p role="alert" className="moments-muted" style={{ marginTop: '0.7rem', color: '#8a2b2b' }}>
                {error}
              </p>
            ) : null}
            <label className="moments-label" htmlFor="lead-name">
              {copy.leadName}
            </label>
            <input
              id="lead-name"
              ref={nameRef}
              className="moments-field"
              value={name}
              maxLength={80}
              autoComplete="name"
              onChange={(e) => setName(e.target.value)}
            />
            <label className="moments-label" htmlFor="lead-phone">
              {copy.leadPhone}
            </label>
            <input
              id="lead-phone"
              className="moments-field"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              maxLength={24}
              onChange={(e) => setPhone(e.target.value)}
            />
            <label className="moments-label" htmlFor="lead-notes">
              {copy.leadNotes}
            </label>
            <textarea
              id="lead-notes"
              className="moments-area"
              rows={3}
              maxLength={2000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <div className="moments-hidden" aria-hidden="true">
              <label>
                Company
                <input tabIndex={-1} autoComplete="off" value={company} onChange={(e) => setCompany(e.target.value)} />
              </label>
            </div>
            <button
              className="moments-btn"
              style={{ marginTop: '1.1rem' }}
              type="button"
              disabled={busy}
              onClick={() => void submit()}
            >
              {copy.leadSubmit}
            </button>
            <button className="moments-link" type="button" onClick={onClose}>
              {copy.close}
            </button>
          </>
        )}
      </div>
    </>
  )
}

export function MomentsLeadFooter({
  copy,
  onOpen,
}: {
  copy: GuestCopy
  onOpen: () => void
}) {
  return (
    <div className="moments-lead-foot">
      <button className="moments-btn-lead" type="button" onClick={onOpen}>
        {copy.wantThisEvent}
      </button>
      <p className="moments-copyright">{copy.copyright}</p>
    </div>
  )
}
