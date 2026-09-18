import { type FormEvent, useEffect, useState } from 'react'
import { api } from '../../api/client'

type EventForm = Record<string, string | boolean | number | null>

export function EventSettingsPage() {
  const [form, setForm] = useState<EventForm | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)

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
          ticketHeadingEn: String(event.ticketHeadingEn ?? 'Save\nthe\nDate'),
          ticketHeadingAr: String(event.ticketHeadingAr ?? 'احفظوا\nالتاريخ'),
          ticketHeadingHe: String(event.ticketHeadingHe ?? 'שמרו\nאת\nהתאריך'),
          celebrationNoteEn: String(event.celebrationNoteEn ?? 'A celebration\nis on its way'),
          celebrationNoteAr: String(event.celebrationNoteAr ?? 'احتفال\nفي الطريق'),
          celebrationNoteHe: String(event.celebrationNoteHe ?? 'חגיגה\nבדרך'),
        })
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed'))
  }, [])

  if (!form) return <p>Loading settings…</p>

  function setField(key: string, value: string | boolean) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  async function uploadField(field: 'imageCoupleColor' | 'imageCoupleBw', file: File | null) {
    if (!file) return
    setUploading(field)
    setError(null)
    try {
      const { url } = await api.uploadImage(file)
      setField(field, url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(null)
    }
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
        celebrationNoteEn: current.celebrationNoteEn ? String(current.celebrationNoteEn) : null,
        celebrationNoteAr: current.celebrationNoteAr ? String(current.celebrationNoteAr) : null,
        celebrationNoteHe: current.celebrationNoteHe ? String(current.celebrationNoteHe) : null,
        ticketHeadingEn: current.ticketHeadingEn ? String(current.ticketHeadingEn) : null,
        ticketHeadingAr: current.ticketHeadingAr ? String(current.ticketHeadingAr) : null,
        ticketHeadingHe: current.ticketHeadingHe ? String(current.ticketHeadingHe) : null,
        imageCoupleColor: current.imageCoupleColor ? String(current.imageCoupleColor) : null,
        imageCoupleBw: current.imageCoupleBw ? String(current.imageCoupleBw) : null,
      }
      await api.updateEvent(payload)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    }
  }

  return (
    <div>
      <div className="admin-top">
        <h1>Event settings</h1>
      </div>
      <form onSubmit={onSubmit} className="admin-card">
        <h2 style={{ marginTop: 0 }}>Invitation card content</h2>
        <p style={{ color: 'var(--admin-muted)', marginTop: 0 }}>
          Change texts and photos inside the card. Layout and design stay the same.
        </p>

        <div className="admin-grid-2">
          <div className="admin-field">
            <label>Bride name</label>
            <input value={String(form.brideName ?? '')} onChange={(e) => setField('brideName', e.target.value)} />
          </div>
          <div className="admin-field">
            <label>Groom name</label>
            <input value={String(form.groomName ?? '')} onChange={(e) => setField('groomName', e.target.value)} />
          </div>
        </div>

        <div className="admin-grid-2">
          <div className="admin-field">
            <label>Event date (shows on yellow ticket)</label>
            <input
              type="date"
              value={String(form.eventDate ?? '')}
              onChange={(e) => setField('eventDate', e.target.value)}
            />
          </div>
          <div className="admin-field">
            <label>Start time</label>
            <input
              value={String(form.eventStartTime ?? '')}
              onChange={(e) => setField('eventStartTime', e.target.value)}
              placeholder="18:00"
            />
          </div>
        </div>

        <h3>Yellow ticket text (3 lines)</h3>
        <p style={{ color: 'var(--admin-muted)', fontSize: '0.9rem' }}>
          One word/phrase per line. Example: Save / the / Date
        </p>
        <div className="admin-grid-2">
          <div className="admin-field">
            <label>Ticket heading EN</label>
            <textarea
              rows={3}
              value={String(form.ticketHeadingEn ?? '')}
              onChange={(e) => setField('ticketHeadingEn', e.target.value)}
            />
          </div>
          <div className="admin-field">
            <label>Ticket heading AR</label>
            <textarea
              rows={3}
              dir="rtl"
              value={String(form.ticketHeadingAr ?? '')}
              onChange={(e) => setField('ticketHeadingAr', e.target.value)}
            />
          </div>
        </div>
        <div className="admin-field">
          <label>Ticket heading HE</label>
          <textarea
            rows={3}
            dir="rtl"
            value={String(form.ticketHeadingHe ?? '')}
            onChange={(e) => setField('ticketHeadingHe', e.target.value)}
          />
        </div>

        <h3>White torn paper note</h3>
        <div className="admin-grid-2">
          <div className="admin-field">
            <label>Note EN</label>
            <textarea
              rows={3}
              value={String(form.celebrationNoteEn ?? '')}
              onChange={(e) => setField('celebrationNoteEn', e.target.value)}
            />
          </div>
          <div className="admin-field">
            <label>Note AR</label>
            <textarea
              rows={3}
              dir="rtl"
              value={String(form.celebrationNoteAr ?? '')}
              onChange={(e) => setField('celebrationNoteAr', e.target.value)}
            />
          </div>
        </div>
        <div className="admin-field">
          <label>Note HE</label>
          <textarea
            rows={3}
            dir="rtl"
            value={String(form.celebrationNoteHe ?? '')}
            onChange={(e) => setField('celebrationNoteHe', e.target.value)}
          />
        </div>

        <h3>Photos</h3>
        <div className="admin-grid-2">
          <div className="admin-field">
            <label>Main couple photo</label>
            {form.imageCoupleColor ? (
              <img
                src={String(form.imageCoupleColor)}
                alt="Main"
                style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 12 }}
              />
            ) : null}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => void uploadField('imageCoupleColor', e.target.files?.[0] ?? null)}
            />
            {uploading === 'imageCoupleColor' && <span>Uploading…</span>}
          </div>
          <div className="admin-field">
            <label>Black & white photo</label>
            {form.imageCoupleBw ? (
              <img
                src={String(form.imageCoupleBw)}
                alt="BW"
                style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 12 }}
              />
            ) : null}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => void uploadField('imageCoupleBw', e.target.files?.[0] ?? null)}
            />
            {uploading === 'imageCoupleBw' && <span>Uploading…</span>}
          </div>
        </div>

        <h3>Envelope tagline</h3>
        <div className="admin-grid-2">
          <div className="admin-field">
            <label>Tagline EN</label>
            <textarea rows={2} value={String(form.taglineEn ?? '')} onChange={(e) => setField('taglineEn', e.target.value)} />
          </div>
          <div className="admin-field">
            <label>Tagline AR</label>
            <textarea rows={2} dir="rtl" value={String(form.taglineAr ?? '')} onChange={(e) => setField('taglineAr', e.target.value)} />
          </div>
        </div>
        <div className="admin-field">
          <label>Tagline HE</label>
          <textarea rows={2} dir="rtl" value={String(form.taglineHe ?? '')} onChange={(e) => setField('taglineHe', e.target.value)} />
        </div>

        <h3>Event details</h3>
        <div className="admin-field">
          <label>Event title</label>
          <input value={String(form.title ?? '')} onChange={(e) => setField('title', e.target.value)} />
        </div>
        <div className="admin-field">
          <label>Venue name</label>
          <input value={String(form.venueName ?? '')} onChange={(e) => setField('venueName', e.target.value)} />
        </div>
        <div className="admin-field">
          <label>Venue address</label>
          <input value={String(form.venueAddress ?? '')} onChange={(e) => setField('venueAddress', e.target.value)} />
        </div>
        <div className="admin-grid-2">
          <div className="admin-field">
            <label>Google Maps URL</label>
            <input value={String(form.googleMapsUrl ?? '')} onChange={(e) => setField('googleMapsUrl', e.target.value)} />
          </div>
          <div className="admin-field">
            <label>Waze URL</label>
            <input value={String(form.wazeUrl ?? '')} onChange={(e) => setField('wazeUrl', e.target.value)} />
          </div>
        </div>
        <div className="admin-field">
          <label>RSVP deadline</label>
          <input
            type="datetime-local"
            value={String(form.rsvpDeadline ?? '')}
            onChange={(e) => setField('rsvpDeadline', e.target.value)}
          />
        </div>
        <div className="admin-grid-2">
          <div className="admin-field">
            <label>Contact phone</label>
            <input value={String(form.contactPhone ?? '')} onChange={(e) => setField('contactPhone', e.target.value)} />
          </div>
          <div className="admin-field">
            <label>WhatsApp phone</label>
            <input value={String(form.whatsappPhone ?? '')} onChange={(e) => setField('whatsappPhone', e.target.value)} />
          </div>
        </div>
        <div className="admin-field">
          <label>Dress code</label>
          <input value={String(form.dressCode ?? '')} onChange={(e) => setField('dressCode', e.target.value)} />
        </div>
        <div className="admin-field">
          <label>Parking info</label>
          <textarea rows={2} value={String(form.parkingInfo ?? '')} onChange={(e) => setField('parkingInfo', e.target.value)} />
        </div>

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
        {saved && <p>Saved. Open a guest invitation link to see the card update.</p>}
        <button className="admin-btn" type="submit">
          Save settings
        </button>
      </form>
    </div>
  )
}
