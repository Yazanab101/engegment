import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { useInvitation } from '../invitation/InvitationContext'
import styles from './InvitationExtras.module.css'

export function InvitationExtras() {
  const { token, guest, event, calendar, t, refreshGuest, locale, setLocaleOverride } =
    useInvitation()
  const [status, setStatus] = useState(guest?.rsvpStatus ?? 'PENDING')
  const [count, setCount] = useState(Math.max(1, guest?.attendingGuestCount || 1))
  const [message, setMessage] = useState(guest?.message ?? '')
  const [phase, setPhase] = useState<'choose' | 'count' | 'done'>(
    guest?.rsvpStatus && guest.rsvpStatus !== 'PENDING' ? 'done' : 'choose',
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!guest) return
    setStatus(guest.rsvpStatus)
    setCount(Math.max(1, guest.attendingGuestCount || 1))
    setMessage(guest.message ?? '')
    setPhase(guest.rsvpStatus !== 'PENDING' ? 'done' : 'choose')
  }, [guest])

  const max = guest?.maxGuestsAllowed ?? 1
  const closed = event?.rsvpClosed ?? false

  const countdown = useCountdown(event?.eventDate)

  if (!token || !guest || !event) return null

  async function track(type: 'LOCATION_CLICKED' | 'CALENDAR_CLICKED', metadata?: object) {
    if (!token) return
    try {
      await api.trackEvent(token, type, metadata)
    } catch {
      /* non-blocking */
    }
  }

  async function save(nextStatus: 'ATTENDING' | 'NOT_ATTENDING', nextCount?: number) {
    if (!token || !guest) return
    if (closed && !editing) return
    setSaving(true)
    setError(null)
    try {
      const result = await api.submitRsvp(token, {
        status: nextStatus,
        guestCount: nextStatus === 'ATTENDING' ? nextCount ?? count : 0,
        message: message.trim() ? message.trim() : null,
      })
      refreshGuest({
        ...guest,
        rsvpStatus: result.status,
        attendingGuestCount: result.guestCount,
        message: result.message,
      })
      setStatus(result.status)
      setCount(Math.max(1, result.guestCount || 1))
      setPhase('done')
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={styles.wrap} aria-label="Invitation details">
      {guest?.displayName ? <p className={styles.guestBanner}>{guest.displayName}</p> : null}
      <div className={styles.langRow}>
        <label htmlFor="lang">{t('language')}</label>
        <select
          id="lang"
          value={locale}
          onChange={(e) => setLocaleOverride(e.target.value as 'EN' | 'AR' | 'HE')}
        >
          <option value="EN">English</option>
          <option value="AR">العربية</option>
          <option value="HE">עברית</option>
        </select>
      </div>

      {countdown && (
        <div className={styles.card}>
          <h2>{t('countdown')}</h2>
          <div className={styles.countdown}>
            <div><strong>{countdown.days}</strong><span>{t('days')}</span></div>
            <div><strong>{countdown.hours}</strong><span>{t('hours')}</span></div>
            <div><strong>{countdown.minutes}</strong><span>{t('minutes')}</span></div>
            <div><strong>{countdown.seconds}</strong><span>{t('seconds')}</span></div>
          </div>
        </div>
      )}

      <div className={styles.card}>
        <h2>{t('location')}</h2>
        <p className={styles.venue}>{event.venueName}</p>
        <p className={styles.muted}>{event.venueAddress}</p>
        <p className={styles.muted}>
          {new Date(event.eventDate).toLocaleDateString(locale === 'AR' ? 'ar' : locale === 'HE' ? 'he' : 'en-US', {
            timeZone: 'UTC',
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}{' '}
          · {event.eventStartTime}
        </p>
        <div className={styles.actions}>
          {event.googleMapsUrl && (
            <a
              href={event.googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => track('LOCATION_CLICKED', { provider: 'google' })}
            >
              {t('openGoogleMaps')}
            </a>
          )}
          {event.wazeUrl && (
            <a
              href={event.wazeUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => track('LOCATION_CLICKED', { provider: 'waze' })}
            >
              {t('openWaze')}
            </a>
          )}
        </div>
      </div>

      {calendar && (
        <div className={styles.card}>
          <h2>{t('addToCalendar')}</h2>
          <div className={styles.actions}>
            <a
              href={calendar.googleUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => track('CALENDAR_CLICKED', { provider: 'google' })}
            >
              {t('googleCalendar')}
            </a>
            <a
              href={calendar.icsUrl}
              onClick={() => track('CALENDAR_CLICKED', { provider: 'ics' })}
            >
              {t('downloadIcs')}
            </a>
          </div>
        </div>
      )}

      {(event.dressCode || event.parkingInfo || event.additionalInfo || event.eventStartTime) && (
        <div className={styles.card}>
          {event.eventStartTime && (
            <p><strong>{t('celebrationTime')}:</strong> {event.eventStartTime}</p>
          )}
          {event.dressCode && (
            <p><strong>{t('dressCode')}:</strong> {event.dressCode}</p>
          )}
          {event.parkingInfo && (
            <p><strong>{t('parking')}:</strong> {event.parkingInfo}</p>
          )}
          {event.additionalInfo && <p>{event.additionalInfo}</p>}
        </div>
      )}

      <div className={styles.card}>
        <h2>{t('willYouJoin')}</h2>
        {closed && !editing ? (
          <p className={styles.muted}>{t('rsvpClosed')}</p>
        ) : null}

        {phase === 'done' && !editing ? (
          <div className={styles.done}>
            {status === 'ATTENDING' ? (
              <>
                <p>{t('youAreAttending')}</p>
                <p>{t('guestsConfirmed', { count: guest.attendingGuestCount })}</p>
                <p className={styles.success}>{t('thankYouAttend')}</p>
              </>
            ) : (
              <>
                <p>{t('notAttendingLabel')}</p>
                <p className={styles.success}>{t('thankYouDecline')}</p>
              </>
            )}
            {!closed && (
              <button type="button" className={styles.secondary} onClick={() => setEditing(true)}>
                {t('updateRsvp')}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className={styles.actionsCol}>
              <button
                type="button"
                className={styles.primary}
                disabled={saving || (closed && !editing)}
                onClick={() => {
                  setStatus('ATTENDING')
                  setPhase('count')
                }}
              >
                {t('yesAttend')}
              </button>
              <button
                type="button"
                className={styles.secondary}
                disabled={saving || (closed && !editing)}
                onClick={() => save('NOT_ATTENDING', 0)}
              >
                {t('noAttend')}
              </button>
            </div>

            {phase === 'count' && (
              <div className={styles.countBox}>
                <p>{t('howMany')}</p>
                <div className={styles.stepper} dir="ltr">
                  <button
                    type="button"
                    aria-label="Decrease"
                    onClick={() => setCount((c) => Math.max(1, c - 1))}
                    disabled={count <= 1}
                  >
                    −
                  </button>
                  <span className={styles.stepperValue}>{count}</span>
                  <button
                    type="button"
                    aria-label="Increase"
                    onClick={() => setCount((c) => Math.min(max, c + 1))}
                    disabled={count >= max}
                  >
                    +
                  </button>
                </div>
                <p className={styles.muted}>{t('maxGuests', { count: max })}</p>
                <label className={styles.messageLabel}>
                  {t('messageToCouple')} ({t('messageOptional')})
                  <textarea
                    value={message}
                    maxLength={500}
                    rows={3}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={saving}
                  onClick={() => save('ATTENDING', count)}
                >
                  {t('confirmAttendance')}
                </button>
              </div>
            )}
          </>
        )}
        {error && <p className={styles.error}>{error}</p>}
      </div>

      {(event.contactPhone || event.whatsappPhone) && (
        <div className={styles.actions}>
          {event.contactPhone && (
            <a href={`tel:${event.contactPhone}`}>{t('call')}</a>
          )}
          {event.whatsappPhone && (
            <a
              href={`https://wa.me/${event.whatsappPhone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
            >
              {t('whatsapp')}
            </a>
          )}
        </div>
      )}

      {event.footer && <p className={styles.footer}>{event.footer}</p>}
    </section>
  )
}

function useCountdown(iso?: string | null) {
  const target = useMemo(() => (iso ? new Date(iso).getTime() : null), [iso])
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!target) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [target])

  if (!target) return null
  const diff = Math.max(0, target - now)
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)
  return { days, hours, minutes, seconds }
}
