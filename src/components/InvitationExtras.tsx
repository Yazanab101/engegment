import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import { useInvitation } from '../invitation/InvitationContext'
import {
  buildIcs,
  downloadIcsFile,
  fieldsFromEvent,
  openGoogleCalendar,
} from '../lib/calendarEvent'
import { getCalendarPlatform, type CalendarPlatform } from '../lib/calendarPlatform'
import styles from './InvitationExtras.module.css'

export function InvitationExtras() {
  const { token, guest, event, calendar, t, refreshGuest, locale, setLocaleOverride, rtl, content } =
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
  const [calendarMenuOpen, setCalendarMenuOpen] = useState(false)
  const [platform, setPlatform] = useState<CalendarPlatform>('desktop')
  const calendarMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!guest) return
    setStatus(guest.rsvpStatus)
    setCount(Math.max(1, guest.attendingGuestCount || 1))
    setMessage(guest.message ?? '')
    setPhase(guest.rsvpStatus !== 'PENDING' ? 'done' : 'choose')
  }, [guest])

  useEffect(() => {
    setPlatform(getCalendarPlatform())
  }, [])

  useEffect(() => {
    if (!calendarMenuOpen) return

    function onPointerDown(e: MouseEvent) {
      if (!calendarMenuRef.current?.contains(e.target as Node)) {
        setCalendarMenuOpen(false)
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setCalendarMenuOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [calendarMenuOpen])

  const max = guest?.maxGuestsAllowed ?? 1
  const closed = event?.rsvpClosed ?? false
  const demoDateIso = '2026-11-21T18:00:00.000Z'
  const countdown = useCountdown(event?.eventDate ?? demoDateIso)

  /* Demo mode (/) has no token — still show countdown + location */
  if (!token || !guest || !event) {
    return (
      <section
        id="invitation-details"
        className={styles.wrap}
        aria-label="Invitation details"
        dir={rtl ? 'rtl' : 'ltr'}
      >
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
          <p className={styles.venue}>{content.venue}</p>
          <p className={styles.muted}>{content.address}</p>
          <p className={styles.muted}>
            {content.date} · {content.time}
          </p>
        </div>
      </section>
    )
  }

  async function track(type: 'LOCATION_CLICKED' | 'CALENDAR_CLICKED', metadata?: object) {
    if (!token) return
    try {
      await api.trackEvent(token, type, metadata)
    } catch {
      /* non-blocking */
    }
  }

  function trackCalendar(provider: 'google' | 'ics') {
    void track('CALENDAR_CLICKED', { provider, platform })
  }

  function downloadGeneratedIcs(preferNavigate = false) {
    if (!event) return
    const fields = fieldsFromEvent(event, {
      url: typeof window !== 'undefined' ? window.location.href : event.googleMapsUrl,
    })
    downloadIcsFile(buildIcs(fields), 'invitation.ics', { preferNavigate })
  }

  function handleIcsAction() {
    trackCalendar('ics')
    downloadGeneratedIcs(platform === 'ios')
  }

  function handleGoogleAction() {
    if (!calendar) return
    trackCalendar('google')
    const opened = openGoogleCalendar(calendar.googleUrl)
    if (!opened) downloadGeneratedIcs()
  }

  function handlePrimaryCalendar() {
    if (platform === 'ios') {
      handleIcsAction()
      return
    }
    handleGoogleAction()
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
    <section
      id="invitation-details"
      className={styles.wrap}
      aria-label="Invitation details"
      dir={rtl ? 'rtl' : 'ltr'}
    >
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
        <div className={styles.mapActions}>
          {event.googleMapsUrl && (
            <a
              className={styles.mapIconLink}
              href={event.googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={t('openGoogleMaps')}
              title={t('openGoogleMaps')}
              onClick={() => track('LOCATION_CLICKED', { provider: 'google' })}
            >
              <GoogleMapsIcon />
            </a>
          )}
          {event.wazeUrl && (
            <a
              className={styles.mapIconLink}
              href={event.wazeUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={t('openWaze')}
              title={t('openWaze')}
              onClick={() => track('LOCATION_CLICKED', { provider: 'waze' })}
            >
              <WazeIcon />
            </a>
          )}
        </div>
      </div>

      {calendar && (
        <div className={styles.card}>
          <h2>{t('addToCalendar')}</h2>
          <div className={styles.calendarBlock}>
            <button
              type="button"
              className={styles.calendarPrimary}
              onClick={handlePrimaryCalendar}
            >
              {t('addToCalendar')}
            </button>

            {platform === 'desktop' ? (
              <div className={styles.calendarMenuWrap} ref={calendarMenuRef}>
                <button
                  type="button"
                  className={styles.calendarMenuToggle}
                  aria-expanded={calendarMenuOpen}
                  aria-haspopup="menu"
                  onClick={() => setCalendarMenuOpen((open) => !open)}
                >
                  {t('otherCalendarOptions')}
                </button>
                {calendarMenuOpen && (
                  <ul className={styles.calendarMenu} role="menu">
                    <li role="none">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setCalendarMenuOpen(false)
                          handleGoogleAction()
                        }}
                      >
                        {t('googleCalendar')}
                      </button>
                    </li>
                    <li role="none">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setCalendarMenuOpen(false)
                          handleIcsAction()
                        }}
                      >
                        {t('appleCalendar')}
                      </button>
                    </li>
                    <li role="none">
                      <a
                        role="menuitem"
                        href={calendar.icsUrl}
                        onClick={() => {
                          setCalendarMenuOpen(false)
                          trackCalendar('ics')
                        }}
                      >
                        {t('downloadIcs')}
                      </a>
                    </li>
                  </ul>
                )}
                <noscript>
                  <a className={styles.calendarFallback} href={calendar.icsUrl}>
                    {t('downloadIcs')}
                  </a>
                </noscript>
              </div>
            ) : (
              <a
                className={styles.calendarFallback}
                href={calendar.icsUrl}
                onClick={() => trackCalendar('ics')}
              >
                {t('downloadIcs')}
              </a>
            )}
          </div>
        </div>
      )}

      {(event.parkingInfo || event.additionalInfo || event.eventStartTime) && (
        <div className={styles.card}>
          {event.eventStartTime && (
            <p><strong>{t('celebrationTime')}:</strong> {event.eventStartTime}</p>
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
        <div className={styles.contactActions}>
          {event.contactPhone && (
            <a
              className={styles.mapIconLink}
              href={`tel:${event.contactPhone}`}
              aria-label={t('call')}
              title={t('call')}
            >
              <PhoneIcon />
            </a>
          )}
          {event.whatsappPhone && (
            <a
              className={styles.mapIconLink}
              href={`https://wa.me/${event.whatsappPhone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              aria-label={t('whatsapp')}
              title={t('whatsapp')}
            >
              <WhatsAppIcon />
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

function GoogleMapsIcon() {
  return (
    <svg viewBox="0 0 48 48" width="28" height="28" aria-hidden>
      <defs>
        <linearGradient id="gmapsPin" x1="8" y1="6" x2="40" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#EA4335" />
          <stop offset="28%" stopColor="#FBBC04" />
          <stop offset="55%" stopColor="#34A853" />
          <stop offset="78%" stopColor="#4285F4" />
          <stop offset="100%" stopColor="#A142F4" />
        </linearGradient>
      </defs>
      <path
        fill="url(#gmapsPin)"
        d="M24 4c-7.7 0-14 6.2-14 13.9 0 9.8 11.2 23.4 13.4 25.9a.9.9 0 0 0 1.3 0C26.8 41.3 38 27.7 38 17.9 38 10.2 31.7 4 24 4z"
      />
      <circle cx="24" cy="18" r="7.2" fill="#fff" />
    </svg>
  )
}

function WazeIcon() {
  return (
    <img
      className={styles.brandIcon}
      src="/assets/icons/waze.png"
      alt=""
      aria-hidden
      draggable={false}
    />
  )
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden>
      <path
        fill="#1B7A4B"
        d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.2 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1l-2.2 2.2z"
      />
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden>
      <path
        fill="#25D366"
        d="M12 2a9.9 9.9 0 0 0-8.5 14.9L2.1 21.5a.7.7 0 0 0 .9.9l4.6-1.4A9.9 9.9 0 1 0 12 2zm0 1.8a8.1 8.1 0 0 1 6.8 12.4l-.3.4.9 3-3.1-.9-.4.2A8.1 8.1 0 1 1 12 3.8zm4.6 9.7c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1-.2.2-.6.8-.7.9-.1.2-.3.2-.5.1-.2-.1-.9-.3-1.8-1.1-.7-.6-1.1-1.3-1.2-1.5-.1-.2 0-.4.1-.5l.4-.4c.1-.1.2-.3.3-.4.1-.2.1-.3 0-.4-.1-.1-.5-1.3-.7-1.7-.2-.5-.4-.4-.5-.4h-.4c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.3c.1.2 1.6 2.5 3.9 3.4 2.3.9 2.3.6 2.7.6.4 0 1.3-.5 1.5-1 .2-.5.2-.9.1-1 0-.1-.2-.1-.4-.2z"
      />
    </svg>
  )
}
