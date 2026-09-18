export type Language = 'AR' | 'HE' | 'EN'
export type RsvpStatus = 'PENDING' | 'ATTENDING' | 'NOT_ATTENDING'

export type PublicGuest = {
  displayName: string
  language: Language
  maxGuestsAllowed: number
  rsvpStatus: RsvpStatus
  attendingGuestCount: number
  message: string | null
  tableNumber: string | null
}

export type PublicEvent = {
  title: string
  brideName: string
  groomName: string
  eventDate: string
  eventStartTime: string
  venueName: string
  venueAddress: string
  googleMapsUrl: string | null
  wazeUrl: string | null
  latitude: number | null
  longitude: number | null
  rsvpDeadline: string | null
  contactPhone: string | null
  whatsappPhone: string | null
  dressCode: string | null
  parkingInfo: string | null
  additionalInfo: string | null
  showTableAssignments: boolean
  intro: string | null
  footer: string | null
  tagline: string | null
  joinUsMessage: string | null
  celebrationNote: string | null
  rsvpClosed: boolean
}

export type InvitationPayload = {
  guest: PublicGuest
  event: PublicEvent
  calendar: {
    googleUrl: string
    icsUrl: string
  }
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })
  if (!res.ok) {
    let message = 'Request failed'
    try {
      const data = (await res.json()) as { error?: string }
      message = data.error ?? message
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }
  if (res.status === 204) return undefined as T
  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) return (await res.json()) as T
  return (await res.text()) as T
}

export const api = {
  getInvitation: (token: string) => request<InvitationPayload>(`/api/invitations/${token}`),
  openInvitation: (token: string) =>
    request<{ counted: boolean }>(`/api/invitations/${token}/open`, { method: 'POST', body: '{}' }),
  submitRsvp: (
    token: string,
    body: { status: 'ATTENDING' | 'NOT_ATTENDING'; guestCount?: number; message?: string | null },
  ) =>
    request<{ status: RsvpStatus; guestCount: number; message: string | null }>(
      `/api/invitations/${token}/rsvp`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  trackEvent: (token: string, type: 'LOCATION_CLICKED' | 'CALENDAR_CLICKED', metadata?: object) =>
    request(`/api/invitations/${token}/events`, {
      method: 'POST',
      body: JSON.stringify({ type, metadata }),
    }),
  adminLogin: (email: string, password: string) =>
    request<{ id: string; email: string; name: string | null }>('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  adminLogout: () => request('/api/admin/auth/logout', { method: 'POST', body: '{}' }),
  adminMe: () => request<{ id: string; email: string; name: string | null }>('/api/admin/auth/me'),
  dashboard: () => request<Record<string, unknown>>('/api/admin/dashboard'),
  guests: (params: URLSearchParams) =>
    request<{ total: number; page: number; pageSize: number; items: AdminGuest[] }>(
      `/api/admin/guests?${params.toString()}`,
    ),
  createGuest: (body: unknown) =>
    request('/api/admin/guests', { method: 'POST', body: JSON.stringify(body) }),
  updateGuest: (id: string, body: unknown) =>
    request(`/api/admin/guests/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteGuest: (id: string) => request(`/api/admin/guests/${id}`, { method: 'DELETE' }),
  bulkDeleteGuests: (ids: string[]) =>
    request('/api/admin/guests/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) }),
  regenerateLink: (id: string) =>
    request<{ inviteToken: string; inviteUrl: string }>(`/api/admin/guests/${id}/regenerate-link`, {
      method: 'POST',
      body: '{}',
    }),
  guestWhatsapp: (id: string) =>
    request<{ message: string; url: string; inviteUrl: string }>(`/api/admin/guests/${id}/whatsapp`),
  importGuests: (csv: string) =>
    request<{ successCount: number; failureCount: number; failures: unknown[] }>(
      '/api/admin/guests/import',
      { method: 'POST', body: JSON.stringify({ csv }) },
    ),
  getEvent: () => request<Record<string, unknown>>('/api/admin/events/current'),
  updateEvent: (body: unknown) =>
    request('/api/admin/events/current', { method: 'PATCH', body: JSON.stringify(body) }),
  setGuestRsvp: (id: string, body: unknown) =>
    request(`/api/admin/guests/${id}/rsvp`, { method: 'POST', body: JSON.stringify(body) }),
}

export type AdminGuest = {
  id: string
  fullName: string
  phoneNumber: string | null
  email: string | null
  language: Language
  inviteToken: string
  inviteUrl: string
  isActive: boolean
  maxGuestsAllowed: number
  invitationStatus: string
  displayStatus: string
  firstOpenedAt: string | null
  lastOpenedAt: string | null
  openCount: number
  rsvpStatus: RsvpStatus
  attendingGuestCount: number
  rsvpSubmittedAt: string | null
  message: string | null
  notes: string | null
  tags: string[]
  tableNumber: string | null
  createdAt: string
  updatedAt: string
}
