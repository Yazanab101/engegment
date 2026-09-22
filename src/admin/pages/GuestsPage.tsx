import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, type AdminGuest } from '../../api/client'
import {
  FAMILY_SUFFIX_OPTIONS,
  TITLE_OPTIONS,
  adaptFamilySuffixKeyForLanguage,
  adaptTitleKeyForLanguage,
  composeGuestDisplayName,
  includeFamilyLabel,
  isRtlLanguage,
  type FamilySuffixKey,
  type TitleKey,
} from '../../lib/guestDisplayName'

const filters = [
  { value: 'groom_family', label: 'أهل العريس', group: 'side' },
  { value: 'bride_family', label: 'أهل العروس', group: 'side' },
  { value: 'invite_not_sent', label: 'Not invited yet', group: 'invite' },
  { value: 'invite_sent', label: 'Invite sent', group: 'invite' },
  { value: 'opened', label: 'Opened', group: 'opened' },
  { value: 'not_opened', label: 'Not opened', group: 'opened' },
  { value: 'attending', label: 'Attending', group: 'rsvp' },
  { value: 'not_attending', label: 'Not attending', group: 'rsvp' },
  { value: 'pending', label: 'Pending RSVP', group: 'rsvp' },
  { value: 'ar', label: 'Arabic', group: 'language' },
  { value: 'he', label: 'Hebrew', group: 'language' },
  { value: 'en', label: 'English', group: 'language' },
] as const

type FilterValue = (typeof filters)[number]['value']

function toggleFilter(current: FilterValue[], value: FilterValue): FilterValue[] {
  const meta = filters.find((f) => f.value === value)
  if (!meta) return current
  if (current.includes(value)) return current.filter((v) => v !== value)
  const withoutGroup = current.filter((v) => {
    const other = filters.find((f) => f.value === v)
    return other?.group !== meta.group
  })
  return [...withoutGroup, value]
}

type GuestSide = 'none' | 'groom' | 'bride'

function guestSideFromTags(tags: string[] | undefined): GuestSide {
  if (tags?.includes('GROOM_FAMILY')) return 'groom'
  if (tags?.includes('BRIDE_FAMILY')) return 'bride'
  return 'none'
}

function tagsWithSide(tags: string[] | undefined, side: GuestSide): string[] {
  const base = (tags ?? []).filter((t) => t !== 'GROOM_FAMILY' && t !== 'BRIDE_FAMILY')
  if (side === 'groom') return [...base, 'GROOM_FAMILY']
  if (side === 'bride') return [...base, 'BRIDE_FAMILY']
  return base
}

const emptyForm = {
  titleKey: 'none' as TitleKey,
  fullName: '',
  includeFamily: false,
  familySuffixKey: 'none' as FamilySuffixKey,
  phoneNumber: '',
  email: '',
  language: 'AR' as 'EN' | 'AR' | 'HE',
  maxGuestsAllowed: 50,
  notes: '',
  tableNumber: '',
  isActive: true,
  guestSide: 'none' as GuestSide,
}

export function GuestsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState<AdminGuest[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<FilterValue[]>([])
  const [filterOpen, setFilterOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [modal, setModal] = useState<'create' | 'edit' | 'import' | 'qr' | 'message' | 'whatsapp' | null>(null)
  const [editing, setEditing] = useState<AdminGuest | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [csvText, setCsvText] = useState('name,phone,email,language,maxGuestsAllowed,notes\n')
  const [importResult, setImportResult] = useState<string | null>(null)
  const [qrGuest, setQrGuest] = useState<AdminGuest | null>(null)
  const [messageGuest, setMessageGuest] = useState<AdminGuest | null>(null)
  const [whatsappShare, setWhatsappShare] = useState<{
    guestId: string
    message: string
    url: string
  } | null>(null)
  const [copiedWhatsapp, setCopiedWhatsapp] = useState(false)
  const [menuGuestId, setMenuGuestId] = useState<string | null>(null)
  const [highlightGuestId, setHighlightGuestId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ ids: string[]; label: string } | null>(null)
  const [deleteTyped, setDeleteTyped] = useState('')
  const [unassignConfirm, setUnassignConfirm] = useState<{ count: number } | null>(null)

  const DELETE_CONFIRM_WORD = 'DELETE'

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      page: '1',
      pageSize: '300',
      sortBy: 'createdAt',
      sortDir: 'desc',
    })
    if (activeFilters.length > 0) params.set('filters', activeFilters.join(','))
    if (search.trim()) params.set('search', search.trim())
    const data = await api.guests(params)
    setItems(data.items)
    setTotal(data.total)
  }, [activeFilters, search])

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : 'Failed'))
    const id = window.setInterval(() => void load().catch(() => undefined), 25000)
    return () => window.clearInterval(id)
  }, [load])

  useEffect(() => {
    const guestId = searchParams.get('guest')
    if (!guestId) return
    setHighlightGuestId(guestId)
    const openMessage = searchParams.get('message') === '1'
    const match = items.find((g) => g.id === guestId)
    if (!match) return

    requestAnimationFrame(() => {
      document
        .querySelector(`[data-guest-id="${guestId}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })

    if (openMessage && match.message?.trim()) {
      setMessageGuest(match)
      setModal('message')
    }

    setSearchParams({}, { replace: true })
  }, [searchParams, items, setSearchParams])

  useEffect(() => {
    if (!highlightGuestId) return
    const id = window.setTimeout(() => setHighlightGuestId(null), 4000)
    return () => window.clearTimeout(id)
  }, [highlightGuestId])

  useEffect(() => {
    if (!menuGuestId && !filterOpen) return
    function onPointerDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null
      if (target?.closest('[data-guest-menu]')) return
      if (target?.closest('[data-guest-filters]')) return
      setMenuGuestId(null)
      setFilterOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [menuGuestId, filterOpen])

  const filterLabel = useMemo(() => {
    if (activeFilters.length === 0) return 'All filters'
    if (activeFilters.length === 1) {
      return filters.find((f) => f.value === activeFilters[0])?.label ?? '1 filter'
    }
    return `${activeFilters.length} filters`
  }, [activeFilters])

  function openCreate() {
    setForm(emptyForm)
    setEditing(null)
    setModal('create')
  }

  function openEdit(guest: AdminGuest) {
    setEditing(guest)
    const language = guest.language
    setForm({
      titleKey: adaptTitleKeyForLanguage(language, guest.titleKey) ?? 'none',
      fullName: guest.fullName,
      includeFamily: Boolean(guest.includeFamily),
      familySuffixKey:
        adaptFamilySuffixKeyForLanguage(language, guest.familySuffixKey) ??
        (language === 'EN' ? 'and_family' : 'his_family'),
      phoneNumber: guest.phoneNumber ?? '',
      email: guest.email ?? '',
      language,
      maxGuestsAllowed: guest.maxGuestsAllowed,
      notes: guest.notes ?? '',
      tableNumber: guest.tableNumber ?? '',
      isActive: guest.isActive,
      guestSide: guestSideFromTags(guest.tags),
    })
    setModal('edit')
  }

  function setLanguage(language: typeof form.language) {
    setForm((prev) => ({
      ...prev,
      language,
      titleKey: adaptTitleKeyForLanguage(language, prev.titleKey) ?? 'none',
      familySuffixKey:
        adaptFamilySuffixKeyForLanguage(language, prev.familySuffixKey) ??
        (language === 'EN' ? 'and_family' : 'his_family'),
    }))
  }

  const namePreview = useMemo(
    () =>
      composeGuestDisplayName({
        fullName: form.fullName || '—',
        language: form.language,
        titleKey: form.titleKey,
        includeFamily: form.includeFamily,
        familySuffixKey: form.includeFamily ? form.familySuffixKey : null,
      }),
    [form.fullName, form.language, form.titleKey, form.includeFamily, form.familySuffixKey],
  )

  async function saveGuest(e: FormEvent) {
    e.preventDefault()
    const existingTags = editing?.tags ?? []
    const body = {
      titleKey: form.titleKey,
      fullName: form.fullName,
      includeFamily: form.includeFamily,
      familySuffixKey: form.includeFamily ? form.familySuffixKey : null,
      phoneNumber: form.phoneNumber || null,
      email: form.email || null,
      language: form.language,
      maxGuestsAllowed: Number(form.maxGuestsAllowed),
      notes: form.notes || null,
      tableNumber: form.tableNumber || null,
      isActive: form.isActive,
      tags: tagsWithSide(existingTags, form.guestSide),
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
    setWhatsappShare({ guestId: id, message: data.message, url: data.url })
    setCopiedWhatsapp(false)
    setModal('whatsapp')
    await load()
  }

  async function copyWhatsappMessage() {
    if (!whatsappShare) return
    await navigator.clipboard.writeText(whatsappShare.message)
    setCopiedWhatsapp(true)
    window.setTimeout(() => setCopiedWhatsapp(false), 2000)
  }

  function sendWhatsappNow() {
    if (!whatsappShare) return
    window.open(whatsappShare.url, '_blank', 'noopener,noreferrer')
  }

  async function toggleInviteSent(guest: AdminGuest) {
    await api.updateGuest(guest.id, { inviteSent: !guest.inviteSent })
    await load()
  }

  async function setGuestSide(guest: AdminGuest, side: GuestSide) {
    await api.updateGuest(guest.id, { tags: tagsWithSide(guest.tags, side) })
    await load()
  }

  async function updateAttendingCount(guest: AdminGuest, raw: string) {
    const parsed = Number.parseInt(raw, 10)
    if (!Number.isFinite(parsed) || parsed < 0) return
    if (parsed === guest.attendingGuestCount && guest.displayStatus === 'ATTENDING') return
    if (parsed === 0) {
      await api.setGuestRsvp(guest.id, { status: 'NOT_ATTENDING', guestCount: 0 })
    } else {
      await api.setGuestRsvp(guest.id, { status: 'ATTENDING', guestCount: parsed })
    }
    await load()
  }

  async function assignSelectedSide(side: GuestSide) {
    const targets = items.filter((g) => selected.includes(g.id))
    if (targets.length === 0) return
    await Promise.all(
      targets.map((g) => api.updateGuest(g.id, { tags: tagsWithSide(g.tags, side) })),
    )
    setSelected([])
    setUnassignConfirm(null)
    await load()
  }

  async function confirmUnassign() {
    if (!unassignConfirm) return
    await assignSelectedSide('none')
  }

  function openDeleteConfirm(ids: string[], label: string) {
    setDeleteTyped('')
    setDeleteConfirm({ ids, label })
  }

  async function confirmDelete() {
    if (!deleteConfirm) return
    if (deleteTyped.trim().toUpperCase() !== DELETE_CONFIRM_WORD) return
    const ids = deleteConfirm.ids
    setDeleteConfirm(null)
    setDeleteTyped('')
    if (ids.length === 1) await api.deleteGuest(ids[0])
    else await api.bulkDeleteGuests(ids)
    setSelected((prev) => prev.filter((id) => !ids.includes(id)))
    await load()
  }

  function badgeClass(status: string) {
    if (status === 'ATTENDING') return 'badge attending'
    if (status === 'NOT_ATTENDING') return 'badge not'
    if (status === 'OPENED_PENDING') return 'badge opened'
    return 'badge pending'
  }

  function sideRowClass(guest: AdminGuest) {
    const side = guestSideFromTags(guest.tags)
    const parts = [
      guest.inviteSent ? 'admin-row-invited' : 'admin-row-pending-invite',
      side === 'groom' ? 'admin-row-groom' : '',
      side === 'bride' ? 'admin-row-bride' : '',
    ]
    return parts.filter(Boolean).join(' ')
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
        <div className="admin-filter" data-guest-filters>
          <button
            type="button"
            className={`admin-filter-trigger${activeFilters.length ? ' is-active' : ''}`}
            onClick={() => setFilterOpen((open) => !open)}
            aria-expanded={filterOpen}
          >
            {filterLabel}
            <span aria-hidden>▾</span>
          </button>
          {filterOpen && (
            <div className="admin-filter-menu" role="menu">
              <button
                type="button"
                className={`admin-filter-option${!activeFilters.length ? ' is-selected' : ''}`}
                onClick={() => {
                  setActiveFilters([])
                  setFilterOpen(false)
                }}
              >
                {!activeFilters.length && <span className="admin-filter-check">✓</span>}
                All
              </button>
              {filters.map((f) => {
                const selectedFilter = activeFilters.includes(f.value)
                return (
                  <button
                    key={f.value}
                    type="button"
                    className={`admin-filter-option${selectedFilter ? ' is-selected' : ''}`}
                    onClick={() => setActiveFilters((prev) => toggleFilter(prev, f.value))}
                  >
                    {selectedFilter && <span className="admin-filter-check">✓</span>}
                    {f.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        {selected.length > 0 && (
          <div className="admin-bulk-actions">
            <span className="admin-bulk-count">{selected.length} selected</span>
            <button
              className="admin-btn"
              type="button"
              onClick={() => void assignSelectedSide('groom')}
            >
              أهل العريس
            </button>
            <button
              className="admin-btn"
              type="button"
              onClick={() => void assignSelectedSide('bride')}
            >
              أهل العروس
            </button>
            <button
              className="admin-btn secondary"
              type="button"
              onClick={() => setUnassignConfirm({ count: selected.length })}
            >
              إزالة التعيين
            </button>
            <button
              className="admin-btn danger"
              type="button"
              onClick={() =>
                openDeleteConfirm(
                  selected,
                  selected.length === 1
                    ? items.find((g) => g.id === selected[0])?.displayName ||
                        items.find((g) => g.id === selected[0])?.fullName ||
                        '1 guest'
                    : `${selected.length} guests`,
                )
              }
            >
              Delete selected
            </button>
          </div>
        )}
      </div>

      {error && <p className="admin-error">{error}</p>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th></th>
              <th>Sent</th>
              <th>Side</th>
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
              <tr
                key={g.id}
                data-guest-id={g.id}
                className={`${sideRowClass(g)}${highlightGuestId === g.id ? ' admin-row-flash' : ''}`}
              >
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
                  <label className="admin-sent-toggle" title={g.inviteSent ? 'Marked as invited' : 'Mark as invited'}>
                    <input
                      type="checkbox"
                      checked={Boolean(g.inviteSent)}
                      onChange={() => void toggleInviteSent(g)}
                    />
                    <span className={g.inviteSent ? 'badge invite-sent' : 'badge invite-pending'}>
                      {g.inviteSent ? 'Sent' : 'Not sent'}
                    </span>
                  </label>
                </td>
                <td>
                  <select
                    className="admin-side-select"
                    value={guestSideFromTags(g.tags)}
                    onChange={(e) => void setGuestSide(g, e.target.value as GuestSide)}
                    aria-label="Guest side"
                  >
                    <option value="none">—</option>
                    <option value="groom">أهل العريس</option>
                    <option value="bride">أهل العروس</option>
                  </select>
                </td>
                <td>
                  <div className="admin-guest-cell">
                    <strong>{g.displayName || g.fullName}</strong>
                    {guestSideFromTags(g.tags) === 'groom' ? (
                      <span className="badge side-groom">أهل العريس</span>
                    ) : null}
                    {guestSideFromTags(g.tags) === 'bride' ? (
                      <span className="badge side-bride">أهل العروس</span>
                    ) : null}
                  </div>
                  {g.message?.trim() ? (
                    <div style={{ marginTop: '0.35rem' }}>
                      <button
                        type="button"
                        className="admin-msg-btn"
                        onClick={() => {
                          setMessageGuest(g)
                          setModal('message')
                        }}
                      >
                        ✉️ Message
                      </button>
                    </div>
                  ) : null}
                </td>
                <td>{g.language}</td>
                <td>{g.isActive ? 'Active' : 'Disabled'}</td>
                <td>{g.openCount > 0 || g.firstOpenedAt ? 'Yes' : 'No'}</td>
                <td>{g.openCount}</td>
                <td>
                  <span className={badgeClass(g.displayStatus)}>{g.displayStatus}</span>
                </td>
                <td>
                  <input
                    className="admin-count-input"
                    type="number"
                    min={0}
                    max={50}
                    defaultValue={g.attendingGuestCount}
                    key={`${g.id}-${g.attendingGuestCount}-${g.displayStatus}`}
                    aria-label={`Guests attending for ${g.displayName || g.fullName}`}
                    onBlur={(e) => void updateAttendingCount(g, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        ;(e.target as HTMLInputElement).blur()
                      }
                    }}
                  />
                </td>
                <td>{g.lastOpenedAt ? new Date(g.lastOpenedAt).toLocaleString() : '—'}</td>
                <td>{g.rsvpSubmittedAt ? new Date(g.rsvpSubmittedAt).toLocaleString() : '—'}</td>
                <td>
                  <div className="admin-actions admin-actions-compact">
                    <button type="button" className="admin-wa-btn" onClick={() => void openWhatsApp(g.id)}>
                      WhatsApp
                    </button>
                    <div className="admin-menu" data-guest-menu>
                      <button
                        type="button"
                        className="admin-menu-trigger"
                        aria-label="More actions"
                        aria-expanded={menuGuestId === g.id}
                        onClick={() => setMenuGuestId((id) => (id === g.id ? null : g.id))}
                      >
                        ⋮
                      </button>
                      {menuGuestId === g.id ? (
                        <div className="admin-menu-dropdown" role="menu">
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setMenuGuestId(null)
                              void copyLink(g.inviteUrl)
                            }}
                          >
                            Copy link
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setMenuGuestId(null)
                              setQrGuest(g)
                              setModal('qr')
                            }}
                          >
                            QR
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setMenuGuestId(null)
                              openEdit(g)
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={async () => {
                              setMenuGuestId(null)
                              if (!confirm('Regenerate invitation link? Old link will stop working.')) return
                              await api.regenerateLink(g.id)
                              await load()
                            }}
                          >
                            Regen
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={async () => {
                              setMenuGuestId(null)
                              await api.updateGuest(g.id, { isActive: !g.isActive })
                              await load()
                            }}
                          >
                            {g.isActive ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={async () => {
                              setMenuGuestId(null)
                              await api.setGuestRsvp(g.id, {
                                status: 'NOT_ATTENDING',
                                guestCount: 0,
                              })
                              await load()
                            }}
                          >
                            مش جاي
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={async () => {
                              setMenuGuestId(null)
                              await api.setGuestRsvp(g.id, {
                                status: 'ATTENDING',
                                guestCount: Math.max(1, g.attendingGuestCount || 1),
                              })
                              await load()
                            }}
                          >
                            جاي
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="danger"
                            onClick={() => {
                              setMenuGuestId(null)
                              openDeleteConfirm([g.id], g.displayName || g.fullName)
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
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
              <label>Title / Prefix</label>
              <select
                dir={isRtlLanguage(form.language) ? 'rtl' : 'ltr'}
                value={form.titleKey}
                onChange={(e) => setForm({ ...form, titleKey: e.target.value as TitleKey })}
              >
                {TITLE_OPTIONS[form.language].map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label>Full name</label>
              <input
                required
                dir={isRtlLanguage(form.language) ? 'rtl' : 'ltr'}
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder={form.language === 'AR' ? 'عامر بولص' : form.language === 'HE' ? 'עאמר בולוס' : 'Amer Boulos'}
              />
            </div>
            <div className="admin-field admin-toggle-row">
              <label className="admin-checkbox-label">
                <input
                  type="checkbox"
                  checked={form.includeFamily}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      includeFamily: e.target.checked,
                      familySuffixKey:
                        e.target.checked && (!form.familySuffixKey || form.familySuffixKey === 'none')
                          ? form.language === 'EN'
                            ? 'and_family'
                            : 'his_family'
                          : form.familySuffixKey,
                    })
                  }
                />
                <span dir={isRtlLanguage(form.language) ? 'rtl' : 'ltr'}>
                  {includeFamilyLabel(form.language)}
                </span>
              </label>
            </div>
            {form.includeFamily ? (
              <div className="admin-field">
                <label>Family suffix</label>
                <select
                  dir={isRtlLanguage(form.language) ? 'rtl' : 'ltr'}
                  value={form.familySuffixKey}
                  onChange={(e) =>
                    setForm({ ...form, familySuffixKey: e.target.value as FamilySuffixKey })
                  }
                >
                  {FAMILY_SUFFIX_OPTIONS[form.language].map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="admin-name-preview" dir={isRtlLanguage(form.language) ? 'rtl' : 'ltr'}>
              <span className="admin-name-preview-label">Preview</span>
              <strong>{namePreview}</strong>
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
            <div className="admin-field">
              <label>Language</label>
              <select
                value={form.language}
                onChange={(e) => setLanguage(e.target.value as typeof form.language)}
              >
                <option value="AR">Arabic</option>
                <option value="HE">Hebrew</option>
                <option value="EN">English</option>
              </select>
            </div>
            <div className="admin-field">
              <label>القسم / Side</label>
              <select
                value={form.guestSide}
                onChange={(e) => setForm({ ...form, guestSide: e.target.value as GuestSide })}
              >
                <option value="none">بدون تعيين</option>
                <option value="groom">أهل العريس</option>
                <option value="bride">أهل العروس</option>
              </select>
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
            <h2>QR — {qrGuest.displayName || qrGuest.fullName}</h2>
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

      {modal === 'whatsapp' && whatsappShare && (
        <div
          className="admin-modal-backdrop"
          onClick={() => {
            setModal(null)
            setWhatsappShare(null)
            setCopiedWhatsapp(false)
          }}
        >
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Share on WhatsApp</h2>
            <div className="admin-wa-preview" dir="auto">
              {whatsappShare.message}
            </div>
            <div className="admin-actions" style={{ marginTop: '1rem' }}>
              <button className="admin-btn" type="button" onClick={() => void copyWhatsappMessage()}>
                {copiedWhatsapp ? 'تم النسخ ✓' : 'نسخ الرسالة'}
              </button>
              <button className="admin-wa-btn" type="button" onClick={sendWhatsappNow}>
                فتح واتساب
              </button>
              <button
                className="admin-btn secondary"
                type="button"
                onClick={() => {
                  setModal(null)
                  setWhatsappShare(null)
                  setCopiedWhatsapp(false)
                }}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'message' && messageGuest && (
        <div className="admin-modal-backdrop" onClick={() => setModal(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <p className="admin-msg-from">From: {messageGuest.displayName || messageGuest.fullName}</p>
            <h2 style={{ marginTop: '0.25rem' }}>Guest message</h2>
            <div className="admin-msg-body" dir="auto">
              {messageGuest.message}
            </div>
            <div className="admin-actions" style={{ marginTop: '1rem' }}>
              <button className="admin-btn secondary" type="button" onClick={() => setModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {unassignConfirm && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setUnassignConfirm(null)}
        >
          <div
            className="admin-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="unassign-title"
          >
            <h2 id="unassign-title">تأكيد إزالة التعيين</h2>
            <p className="admin-delete-warning">
              هل أنت متأكد من إزالة تعيين أهل العريس/العروس عن{' '}
              <strong>
                {unassignConfirm.count === 1
                  ? 'ضيف واحد'
                  : `${unassignConfirm.count} ضيوف`}
              </strong>
              ؟ سيتم حذف التعيين من قاعدة البيانات.
            </p>
            <div className="admin-actions">
              <button
                className="admin-btn danger"
                type="button"
                onClick={() => void confirmUnassign()}
              >
                تأكيد الإزالة
              </button>
              <button
                className="admin-btn secondary"
                type="button"
                onClick={() => setUnassignConfirm(null)}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div
          className="admin-modal-backdrop"
          onClick={() => {
            setDeleteConfirm(null)
            setDeleteTyped('')
          }}
        >
          <form
            className="admin-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault()
              void confirmDelete()
            }}
          >
            <h2>Confirm delete</h2>
            <p className="admin-delete-warning">
              سيتم حذف <strong>{deleteConfirm.label}</strong> نهائيًا. هذا الإجراء لا يمكن التراجع عنه.
            </p>
            <div className="admin-field">
              <label>
                اكتب <code>{DELETE_CONFIRM_WORD}</code> للتأكيد
              </label>
              <input
                autoFocus
                value={deleteTyped}
                onChange={(e) => setDeleteTyped(e.target.value)}
                placeholder={DELETE_CONFIRM_WORD}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="admin-actions">
              <button
                className="admin-btn danger"
                type="submit"
                disabled={deleteTyped.trim().toUpperCase() !== DELETE_CONFIRM_WORD}
              >
                Delete
              </button>
              <button
                className="admin-btn secondary"
                type="button"
                onClick={() => {
                  setDeleteConfirm(null)
                  setDeleteTyped('')
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
