import { type FormEvent, useEffect, useState } from 'react'
import { api } from '../../api/client'

type EventForm = Record<string, string | boolean | number | null>

export function EventSettingsPage() {
  const [form, setForm] = useState<EventForm | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .getEvent()
      .then((event) => {
        setForm({
          ...event,
          eventDate: event.eventDate
            ? new Date(String(event.eventDate)).toISOString().slice(0, 10)
            : '',
          rsvpDeadline: event.rsvpDeadline
            ? new Date(String(event.rsvpDeadline)).toISOString().slice(0, 16)
            : '',
        })
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed'))
  }, [])

  if (!form) return <p>Loading settings…</p>

  function setField(key: string, value: string | boolean) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    const current = form
    setError(null)
    setSaved(false)
    try {
      const payload = {
        title: String(current.title ?? ''),
        brideName: String(current.brideName ?? ''),
        groomName: String(current.groomName ?? ''),
        eventDate: new Date(String(current.eventDate)).toISOString(),
        eventStartTime: String(current.eventStartTime ?? ''),
        venueName: String(current.venueName ?? ''),
        venueAddress: String(current.venueAddress ?? ''),
        googleMapsUrl: current.googleMapsUrl ? String(current.googleMapsUrl) : null,
        wazeUrl: current.wazeUrl ? String(current.wazeUrl) : null,
        contactPhone: current.contactPhone ? String(current.contactPhone) : null,
        whatsappPhone: current.whatsappPhone ? String(current.whatsappPhone) : null,
        dressCode: current.dressCode ? String(current.dressCode) : null,
        parkingInfo: current.parkingInfo ? String(current.parkingInfo) : null,
        additionalInfo: current.additionalInfo ? String(current.additionalInfo) : null,
        showTableAssignments: Boolean(current.showTableAssignments),
        rsvpDeadline: current.rsvpDeadline
          ? new Date(String(current.rsvpDeadline)).toISOString()
          : null,
        introEn: current.introEn ? String(current.introEn) : null,
        introAr: current.introAr ? String(current.introAr) : null,
        introHe: current.introHe ? String(current.introHe) : null,
        footerEn: current.footerEn ? String(current.footerEn) : null,
        footerAr: current.footerAr ? String(current.footerAr) : null,
        footerHe: current.footerHe ? String(current.footerHe) : null,
        taglineEn: current.taglineEn ? String(current.taglineEn) : null,
        taglineAr: current.taglineAr ? String(current.taglineAr) : null,
        taglineHe: current.taglineHe ? String(current.taglineHe) : null,
        joinUsMessageEn: current.joinUsMessageEn ? String(current.joinUsMessageEn) : null,
        joinUsMessageAr: current.joinUsMessageAr ? String(current.joinUsMessageAr) : null,
        joinUsMessageHe: current.joinUsMessageHe ? String(current.joinUsMessageHe) : null,
      }
      await api.updateEvent(payload)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    }
  }

  const fields: Array<[string, string, 'text' | 'textarea' | 'checkbox' | 'datetime-local' | 'date']> = [
    ['title', 'Event title', 'text'],
    ['brideName', 'Bride name', 'text'],
    ['groomName', 'Groom name', 'text'],
    ['eventDate', 'Event date', 'date'],
    ['eventStartTime', 'Start time (HH:MM)', 'text'],
    ['venueName', 'Venue name', 'text'],
    ['venueAddress', 'Venue address', 'text'],
    ['googleMapsUrl', 'Google Maps URL', 'text'],
    ['wazeUrl', 'Waze URL', 'text'],
    ['rsvpDeadline', 'RSVP deadline', 'datetime-local'],
    ['contactPhone', 'Contact phone', 'text'],
    ['whatsappPhone', 'WhatsApp phone', 'text'],
    ['dressCode', 'Dress code', 'text'],
    ['parkingInfo', 'Parking info', 'textarea'],
    ['additionalInfo', 'Additional info', 'textarea'],
    ['introEn', 'Intro (EN)', 'textarea'],
    ['introAr', 'Intro (AR)', 'textarea'],
    ['introHe', 'Intro (HE)', 'textarea'],
    ['footerEn', 'Footer (EN)', 'textarea'],
    ['footerAr', 'Footer (AR)', 'textarea'],
    ['footerHe', 'Footer (HE)', 'textarea'],
    ['taglineEn', 'Tagline (EN)', 'textarea'],
    ['taglineAr', 'Tagline (AR)', 'textarea'],
    ['taglineHe', 'Tagline (HE)', 'textarea'],
    ['joinUsMessageEn', 'Join us (EN)', 'text'],
    ['joinUsMessageAr', 'Join us (AR)', 'text'],
    ['joinUsMessageHe', 'Join us (HE)', 'text'],
  ]

  return (
    <div>
      <div className="admin-top">
        <h1>Event settings</h1>
      </div>
      <form onSubmit={onSubmit} className="admin-card">
        {fields.map(([key, label, type]) => (
          <div className="admin-field" key={key}>
            <label>{label}</label>
            {type === 'textarea' ? (
              <textarea
                rows={3}
                value={String(form[key] ?? '')}
                onChange={(e) => setField(key, e.target.value)}
              />
            ) : (
              <input
                type={type}
                value={String(form[key] ?? '')}
                onChange={(e) => setField(key, e.target.value)}
              />
            )}
          </div>
        ))}
        <div className="admin-field">
          <label>
            <input
              type="checkbox"
              checked={Boolean(form.showTableAssignments)}
              onChange={(e) => setField('showTableAssignments', e.target.checked)}
            />{' '}
            Show table assignments to guests
          </label>
        </div>
        {error && <p className="admin-error">{error}</p>}
        {saved && <p>Saved.</p>}
        <button className="admin-btn" type="submit">
          Save settings
        </button>
      </form>
    </div>
  )
}
