import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { api, type AdminGuest } from '../../api/client'

const filters = [
  { value: 'all', label: 'All' },
  { value: 'opened', label: 'Opened' },
  { value: 'not_opened', label: 'Not opened' },
  { value: 'attending', label: 'Attending' },
  { value: 'not_attending', label: 'Not attending' },
  { value: 'pending', label: 'Pending RSVP' },
  { value: 'ar', label: 'Arabic' },
  { value: 'he', label: 'Hebrew' },
  { value: 'en', label: 'English' },
] as const

const emptyForm = {
  fullName: '',
  phoneNumber: '',
  email: '',
  language: 'EN' as 'EN' | 'AR' | 'HE',
  maxGuestsAllowed: 1,
  notes: '',
  tableNumber: '',
  isActive: true,
}

export function GuestsPage() {
  const [items, setItems] = useState<AdminGuest[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<(typeof filters)[number]['value']>('all')
  const [selected, setSelected] = useState<string[]>([])
  const [modal, setModal] = useState<'create' | 'edit' | 'import' | 'qr' | null>(null)
  const [editing, setEditing] = useState<AdminGuest | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [csvText, setCsvText] = useState('name,phone,email,language,maxGuestsAllowed,notes\n')
  const [importResult, setImportResult] = useState<string | null>(null)
  const [qrGuest, setQrGuest] = useState<AdminGuest | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      page: '1',
      pageSize: '100',
      filter,
      sortBy: 'createdAt',
      sortDir: 'desc',
    })
    if (search.trim()) params.set('search', search.trim())
    const data = await api.guests(params)
    setItems(data.items)
    setTotal(data.total)
  }, [filter, search])

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : 'Failed'))
    const id = window.setInterval(() => void load().catch(() => undefined), 25000)
    return () => window.clearInterval(id)
  }, [load])

  function openCreate() {
    setForm(emptyForm)
    setEditing(null)
    setModal('create')
  }

  function openEdit(guest: AdminGuest) {
    setEditing(guest)
    setForm({
      fullName: guest.fullName,
      phoneNumber: guest.phoneNumber ?? '',
      email: guest.email ?? '',
      language: guest.language,
      maxGuestsAllowed: guest.maxGuestsAllowed,
      notes: guest.notes ?? '',
      tableNumber: guest.tableNumber ?? '',
      isActive: guest.isActive,
    })
    setModal('edit')
  }

  async function saveGuest(e: FormEvent) {
    e.preventDefault()
    const body = {
      fullName: form.fullName,
      phoneNumber: form.phoneNumber || null,
      email: form.email || null,
      language: form.language,
      maxGuestsAllowed: Number(form.maxGuestsAllowed),
      notes: form.notes || null,
      tableNumber: form.tableNumber || null,
      isActive: form.isActive,
    }
    if (modal === 'edit' && editing) await api.updateGuest(editing.id, body)
    else await api.createGuest(body)
    setModal(null)
    await load()
  }

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url)
  }

  async function openWhatsApp(id: string) {
    const data = await api.guestWhatsapp(id)
    window.open(data.url, '_blank', 'noopener,noreferrer')
  }

  function badgeClass(status: string) {
    if (status === 'ATTENDING') return 'badge attending'
    if (status === 'NOT_ATTENDING') return 'badge not'
    if (status === 'OPENED_PENDING') return 'badge opened'
    return 'badge pending'
  }

  return (
    <div>
      <div className="admin-top">
        <h1>Guests ({total})</h1>
        <div className="admin-actions">
          <button type="button" onClick={openCreate}>Add guest</button>
          <button type="button" onClick={() => setModal('import')}>Import CSV</button>
          <a href="/api/admin/guests/export">Export guests</a>
          <a href="/api/admin/guests/export-rsvp">Export RSVP</a>
        </div>
      </div>

      <div className="admin-toolbar">
        <input
          placeholder="Search name, phone, email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          {filters.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        {selected.length > 0 && (
          <button
            className="admin-btn danger"
            type="button"
            onClick={async () => {
              if (!confirm(`Delete ${selected.length} guests?`)) return
              await api.bulkDeleteGuests(selected)
              setSelected([])
              await load()
            }}
          >
            Delete selected
          </button>
        )}
      </div>

      {error && <p className="admin-error">{error}</p>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th></th>
              <th>Guest</th>
              <th>Language</th>
              <th>Invitation</th>
              <th>Opened</th>
              <th>Open count</th>
              <th>RSVP</th>
              <th>Guests attending</th>
              <th>Last opened</th>
              <th>Response date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((g) => (
              <tr key={g.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.includes(g.id)}
                    onChange={(e) =>
                      setSelected((prev) =>
                        e.target.checked ? [...prev, g.id] : prev.filter((id) => id !== g.id),
                      )
                    }
                  />
                </td>
                <td>
                  <strong>{g.fullName}</strong>
                  {g.message && <div style={{ color: 'var(--admin-muted)', fontSize: '0.85rem' }}>{g.message}</div>}
                </td>
                <td>{g.language}</td>
                <td>{g.isActive ? 'Active' : 'Disabled'}</td>
                <td>{g.openCount > 0 || g.firstOpenedAt ? 'Yes' : 'No'}</td>
                <td>{g.openCount}</td>
                <td>
                  <span className={badgeClass(g.displayStatus)}>{g.displayStatus}</span>
                </td>
                <td>
                  {g.attendingGuestCount} / {g.maxGuestsAllowed}
                </td>
                <td>{g.lastOpenedAt ? new Date(g.lastOpenedAt).toLocaleString() : '—'}</td>
                <td>{g.rsvpSubmittedAt ? new Date(g.rsvpSubmittedAt).toLocaleString() : '—'}</td>
                <td>
                  <div className="admin-actions">
                    <button type="button" onClick={() => void copyLink(g.inviteUrl)}>Copy link</button>
                    <button type="button" onClick={() => void openWhatsApp(g.id)}>WhatsApp</button>
                    <button
                      type="button"
                      onClick={() => {
                        setQrGuest(g)
                        setModal('qr')
                      }}
                    >
                      QR
                    </button>
                    <button type="button" onClick={() => openEdit(g)}>Edit</button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm('Regenerate invitation link? Old link will stop working.')) return
                        await api.regenerateLink(g.id)
                        await load()
                      }}
                    >
                      Regen
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await api.updateGuest(g.id, { isActive: !g.isActive })
                        await load()
                      }}
                    >
                      {g.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`Delete ${g.fullName}?`)) return
                        await api.deleteGuest(g.id)
                        await load()
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(modal === 'create' || modal === 'edit') && (
        <div className="admin-modal-backdrop" onClick={() => setModal(null)}>
          <form className="admin-modal" onClick={(e) => e.stopPropagation()} onSubmit={saveGuest}>
            <h2>{modal === 'create' ? 'Create guest' : 'Edit guest'}</h2>
            <div className="admin-field">
              <label>Full name</label>
              <input
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div className="admin-grid-2">
              <div className="admin-field">
                <label>Phone</label>
                <input
                  value={form.phoneNumber}
                  onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                />
              </div>
              <div className="admin-field">
                <label>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div className="admin-grid-2">
              <div className="admin-field">
                <label>Language</label>
                <select
                  value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value as typeof form.language })}
                >
                  <option value="EN">English</option>
                  <option value="AR">Arabic</option>
                  <option value="HE">Hebrew</option>
                </select>
              </div>
              <div className="admin-field">
                <label>Max guests</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={form.maxGuestsAllowed}
                  onChange={(e) => setForm({ ...form, maxGuestsAllowed: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="admin-field">
              <label>Table number</label>
              <input
                value={form.tableNumber}
                onChange={(e) => setForm({ ...form, tableNumber: e.target.value })}
              />
            </div>
            <div className="admin-field">
              <label>Notes</label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            {modal === 'edit' && (
              <>
                <div className="admin-field">
                  <label>Active invitation</label>
                  <select
                    value={form.isActive ? 'yes' : 'no'}
                    onChange={(e) => setForm({ ...form, isActive: e.target.value === 'yes' })}
                  >
                    <option value="yes">Active</option>
                    <option value="no">Disabled</option>
                  </select>
                </div>
                <div className="admin-field">
                  <label>Manual RSVP</label>
                  <div className="admin-actions">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!editing) return
                        await api.setGuestRsvp(editing.id, { status: 'ATTENDING', guestCount: 1 })
                        await load()
                        setModal(null)
                      }}
                    >
                      Set attending
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!editing) return
                        await api.setGuestRsvp(editing.id, { status: 'NOT_ATTENDING', guestCount: 0 })
                        await load()
                        setModal(null)
                      }}
                    >
                      Set not attending
                    </button>
                  </div>
                </div>
              </>
            )}
            <div className="admin-actions">
              <button className="admin-btn" type="submit">Save</button>
              <button className="admin-btn secondary" type="button" onClick={() => setModal(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {modal === 'import' && (
        <div className="admin-modal-backdrop" onClick={() => setModal(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Import guests CSV</h2>
            <p style={{ color: 'var(--admin-muted)' }}>
              Columns: name, phone, email, language, maxGuestsAllowed, notes. All rows must be valid.
            </p>
            <textarea rows={10} value={csvText} onChange={(e) => setCsvText(e.target.value)} style={{ width: '100%' }} />
            {importResult && <p>{importResult}</p>}
            <div className="admin-actions" style={{ marginTop: '0.75rem' }}>
              <button
                className="admin-btn"
                type="button"
                onClick={async () => {
                  const result = await api.importGuests(csvText)
                  setImportResult(
                    result.failureCount
                      ? `Failed: ${result.failureCount} rows`
                      : `Imported ${result.successCount} guests`,
                  )
                  if (!result.failureCount) {
                    await load()
                    setModal(null)
                  }
                }}
              >
                Import
              </button>
              <button className="admin-btn secondary" type="button" onClick={() => setModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'qr' && qrGuest && (
        <div className="admin-modal-backdrop" onClick={() => setModal(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <h2>QR — {qrGuest.fullName}</h2>
            <img
              src={`/api/admin/guests/${qrGuest.id}/qr.png`}
              alt="Invitation QR"
              width={280}
              height={280}
            />
            <div className="admin-actions" style={{ justifyContent: 'center', marginTop: '0.75rem' }}>
              <a href={`/api/admin/guests/${qrGuest.id}/qr.png`} download={`${qrGuest.fullName}-qr.png`}>
                Download PNG
              </a>
              <button type="button" onClick={() => window.print()}>Print</button>
              <button type="button" onClick={() => setModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
