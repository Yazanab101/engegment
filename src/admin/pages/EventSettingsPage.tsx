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
          joinUsMessageEn: String(event.joinUsMessageEn ?? "We hope you'll join us"),
          joinUsMessageAr: String(event.joinUsMessageAr ?? 'نأمل أن تشاركونا'),
          joinUsMessageHe: String(event.joinUsMessageHe ?? 'נשמח שתצטרפו אלינו'),
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
        titleAr: current.titleAr ? String(current.titleAr) : null,
        titleHe: current.titleHe ? String(current.titleHe) : null,
        brideName: String(current.brideName ?? ''),
        groomName: String(current.groomName ?? ''),
        eventDate: new Date(String(current.eventDate)).toISOString(),
        eventStartTime: String(current.eventStartTime ?? ''),
        venueName: String(current.venueName ?? ''),
        venueNameAr: current.venueNameAr ? String(current.venueNameAr) : null,
        venueNameHe: current.venueNameHe ? String(current.venueNameHe) : null,
        venueAddress: String(current.venueAddress ?? ''),
        venueAddressAr: current.venueAddressAr ? String(current.venueAddressAr) : null,
        venueAddressHe: current.venueAddressHe ? String(current.venueAddressHe) : null,
        googleMapsUrl: current.googleMapsUrl ? String(current.googleMapsUrl) : null,
        wazeUrl: current.wazeUrl ? String(current.wazeUrl) : null,
        contactPhone: current.contactPhone ? String(current.contactPhone) : null,
        whatsappPhone: current.whatsappPhone ? String(current.whatsappPhone) : null,
        dressCode: current.dressCode ? String(current.dressCode) : null,
        dressCodeAr: current.dressCodeAr ? String(current.dressCodeAr) : null,
        dressCodeHe: current.dressCodeHe ? String(current.dressCodeHe) : null,
        parkingInfo: current.parkingInfo ? String(current.parkingInfo) : null,
        parkingInfoAr: current.parkingInfoAr ? String(current.parkingInfoAr) : null,
        parkingInfoHe: current.parkingInfoHe ? String(current.parkingInfoHe) : null,
        additionalInfo: current.additionalInfo ? String(current.additionalInfo) : null,
        additionalInfoAr: current.additionalInfoAr ? String(current.additionalInfoAr) : null,
        additionalInfoHe: current.additionalInfoHe ? String(current.additionalInfoHe) : null,
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

        <h3>Join us message (under the date)</h3>
        <div className="admin-grid-2">
          <div className="admin-field">
            <label>Join us EN</label>
            <input
              value={String(form.joinUsMessageEn ?? '')}
              onChange={(e) => setField('joinUsMessageEn', e.target.value)}
              placeholder="We hope you'll join us"
            />
          </div>
          <div className="admin-field">
            <label>Join us AR</label>
            <input
              dir="rtl"
              value={String(form.joinUsMessageAr ?? '')}
              onChange={(e) => setField('joinUsMessageAr', e.target.value)}
              placeholder="نأمل أن تشاركونا"
            />
          </div>
        </div>
        <div className="admin-field">
          <label>Join us HE</label>
          <input
            dir="rtl"
            value={String(form.joinUsMessageHe ?? '')}
            onChange={(e) => setField('joinUsMessageHe', e.target.value)}
            placeholder="נשמח שתצטרפו אלינו"
          />
        </div>

        <h3>Event details</h3>
        <div className="admin-grid-2">
          <div className="admin-field">
            <label>Event title EN</label>
            <input value={String(form.title ?? '')} onChange={(e) => setField('title', e.target.value)} />
          </div>
          <div className="admin-field">
            <label>Event title AR</label>
            <input dir="rtl" value={String(form.titleAr ?? '')} onChange={(e) => setField('titleAr', e.target.value)} />
          </div>
        </div>
        <div className="admin-field">
          <label>Event title HE</label>
          <input dir="rtl" value={String(form.titleHe ?? '')} onChange={(e) => setField('titleHe', e.target.value)} />
        </div>

        <div className="admin-grid-2">
          <div className="admin-field">
            <label>Venue name EN</label>
            <input value={String(form.venueName ?? '')} onChange={(e) => setField('venueName', e.target.value)} />
          </div>
          <div className="admin-field">
            <label>Venue name AR</label>
            <input dir="rtl" value={String(form.venueNameAr ?? '')} onChange={(e) => setField('venueNameAr', e.target.value)} />
          </div>
        </div>
        <div className="admin-field">
          <label>Venue name HE</label>
          <input dir="rtl" value={String(form.venueNameHe ?? '')} onChange={(e) => setField('venueNameHe', e.target.value)} />
        </div>

        <div className="admin-grid-2">
          <div className="admin-field">
            <label>Venue address EN</label>
            <input value={String(form.venueAddress ?? '')} onChange={(e) => setField('venueAddress', e.target.value)} />
          </div>
          <div className="admin-field">
            <label>Venue address AR</label>
            <input dir="rtl" value={String(form.venueAddressAr ?? '')} onChange={(e) => setField('venueAddressAr', e.target.value)} />
          </div>
        </div>
        <div className="admin-field">
          <label>Venue address HE</label>
          <input dir="rtl" value={String(form.venueAddressHe ?? '')} onChange={(e) => setField('venueAddressHe', e.target.value)} />
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

        <div className="admin-grid-2">
          <div className="admin-field">
            <label>Dress code EN</label>
            <input value={String(form.dressCode ?? '')} onChange={(e) => setField('dressCode', e.target.value)} />
          </div>
          <div className="admin-field">
            <label>Dress code AR</label>
            <input dir="rtl" value={String(form.dressCodeAr ?? '')} onChange={(e) => setField('dressCodeAr', e.target.value)} />
          </div>
        </div>
        <div className="admin-field">
          <label>Dress code HE</label>
          <input dir="rtl" value={String(form.dressCodeHe ?? '')} onChange={(e) => setField('dressCodeHe', e.target.value)} />
        </div>

        <div className="admin-grid-2">
          <div className="admin-field">
            <label>Parking info EN</label>
            <textarea rows={2} value={String(form.parkingInfo ?? '')} onChange={(e) => setField('parkingInfo', e.target.value)} />
          </div>
          <div className="admin-field">
            <label>Parking info AR</label>
            <textarea rows={2} dir="rtl" value={String(form.parkingInfoAr ?? '')} onChange={(e) => setField('parkingInfoAr', e.target.value)} />
          </div>
        </div>
        <div className="admin-field">
          <label>Parking info HE</label>
          <textarea rows={2} dir="rtl" value={String(form.parkingInfoHe ?? '')} onChange={(e) => setField('parkingInfoHe', e.target.value)} />
        </div>

        <div className="admin-grid-2">
          <div className="admin-field">
            <label>Additional info EN</label>
            <textarea rows={2} value={String(form.additionalInfo ?? '')} onChange={(e) => setField('additionalInfo', e.target.value)} />
          </div>
          <div className="admin-field">
            <label>Additional info AR</label>
            <textarea rows={2} dir="rtl" value={String(form.additionalInfoAr ?? '')} onChange={(e) => setField('additionalInfoAr', e.target.value)} />
          </div>
        </div>
        <div className="admin-field">
          <label>Additional info HE</label>
          <textarea rows={2} dir="rtl" value={String(form.additionalInfoHe ?? '')} onChange={(e) => setField('additionalInfoHe', e.target.value)} />
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
