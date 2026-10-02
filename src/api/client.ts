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
  inviteLead: string | null
  celebrationNote: string | null
  ticketHeading: string | null
  imageCoupleColor: string | null
  imageCoupleBw: string | null
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

const DEFAULT_TIMEOUT_MS = 12_000

async function request<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = init ?? {}
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(rest.headers ?? {}),
      },
      ...rest,
      signal: rest.signal ?? controller.signal,
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
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out')
    }
    throw err
  } finally {
    window.clearTimeout(timeoutId)
  }
}

function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return true
  const message = err.message.toLowerCase()
  if (message.includes('timed out')) return true
  if (message.includes('network') || message.includes('failed to fetch')) return true
  // Do not retry client/not-found responses — they only delay the error UI.
  if (
    message.includes('not found') ||
    message.includes('not available') ||
    message.includes('unauthorized') ||
    message.includes('validation') ||
    message.includes('forbidden')
  ) {
    return false
  }
  return true
}

async function requestWithRetry<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
  retries = 1,
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await request<T>(path, init)
    } catch (err) {
      lastError = err
      if (attempt === retries || !isRetryableError(err)) break
      await new Promise((resolve) => window.setTimeout(resolve, 350 * (attempt + 1)))
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Request failed')
}

export const api = {
  getInvitation: (token: string) =>
    requestWithRetry<InvitationPayload>(`/api/invitations/${token}`, { timeoutMs: 8_000 }, 1),
  openInvitation: (token: string) =>
    request<{ counted: boolean }>(`/api/invitations/${token}/open`, {
      method: 'POST',
      body: '{}',
      timeoutMs: 8_000,
    }),
  submitRsvp: (
    token: string,
    body: { status: 'ATTENDING' | 'NOT_ATTENDING'; guestCount?: number; message?: string | null },
  ) =>
    requestWithRetry<{ status: RsvpStatus; guestCount: number; message: string | null }>(
      `/api/invitations/${token}/rsvp`,
      { method: 'POST', body: JSON.stringify(body), timeoutMs: 12_000 },
      1,
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
  dashboard: () =>
    request<Record<string, unknown>>('/api/admin/dashboard', { timeoutMs: 15_000 }),
  notifications: (limit = 40) =>
    request<{ items: AdminNotification[]; latestAt: string | null }>(
      `/api/admin/notifications?limit=${limit}`,
      { timeoutMs: 10_000 },
    ),
  guests: (params: URLSearchParams) =>
    request<{ total: number; page: number; pageSize: number; items: AdminGuest[] }>(
      `/api/admin/guests?${params.toString()}`,
      { timeoutMs: 15_000 },
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
  memoriesOverview: () => request<MemoriesOverview>('/api/admin/memories/overview'),
  memoriesGuests: (params: URLSearchParams) =>
    request<MemoriesGuest[]>('/api/admin/memories/guests?' + params.toString()),
  memoriesGuest: (id: string) => request<MemoriesGuest>('/api/admin/memories/guests/' + id),
  memoriesGuestDownloadUrls: (id: string) =>
    request<MemoriesDownloadItem[]>('/api/admin/memories/guests/' + id + '/download-urls'),
  memoriesMedia: (params: URLSearchParams) =>
    request<MemoriesMediaPage>('/api/admin/memories/media?' + params.toString()),
  memoriesMediaAction: (ids: string[], action: MemoriesMediaAction) =>
    request('/api/admin/memories/media/action', {
      method: 'POST',
      body: JSON.stringify({ ids, action }),
    }),
  memoriesSignedUrl: (id: string) =>
    request<{ url: string }>('/api/admin/memories/media/' + id + '/signed-url', {
      method: 'POST',
      body: '{}',
    }),
  memoriesMessages: (archived = false, guestId?: string) =>
    request<MemoriesMessage[]>(
      '/api/admin/memories/messages?archived=' +
        String(archived) +
        (guestId ? '&guestId=' + encodeURIComponent(guestId) : ''),
    ),
  memoriesMessageAction: (id: string, action: MemoriesMessageAction) =>
    request('/api/admin/memories/messages/' + id + '/action', {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),
  memoriesSetUploadsOpen: (open: boolean) =>
    request<{ uploadsOpen: boolean }>('/api/admin/memories/uploads-open', {
      method: 'POST',
      body: JSON.stringify({ open }),
    }),
  listStories: () => request<AdminStory[]>('/api/admin/memories/stories'),
  authorizeStory: (body: unknown) =>
    request<{
      storyId: string
      objectKey: string
      thumbnailObjectKey: string | null
      signedUploadUrl: string
      signedThumbUrl: string | null
      expiresAt: string
      intendedActive: boolean
    }>('/api/admin/memories/stories/authorize', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  confirmStory: (body: unknown) =>
    request<{ ok: boolean; storyId: string }>('/api/admin/memories/stories/confirm', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateStory: (id: string, body: unknown) =>
    request(`/api/admin/memories/stories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  reorderStories: (storyIds: string[]) =>
    request('/api/admin/memories/stories/reorder', {
      method: 'POST',
      body: JSON.stringify({ storyIds }),
    }),
  deleteStory: (id: string) => request(`/api/admin/memories/stories/${id}`, { method: 'DELETE' }),
  storySignedUrl: (id: string) =>
    request<{ url: string; thumbUrl: string | null; mediaType: 'photo' | 'video'; expiresIn: number }>(
      `/api/admin/memories/stories/${id}/signed-url`,
      { method: 'POST', body: '{}' },
    ),
  uploadImage: async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''
    const res = await fetch(`${API_BASE}/api/admin/uploads`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(data.error ?? 'Upload failed')
    }
    return (await res.json()) as { url: string }
  },
}

export type MemoriesOverview = {
  event: { id: string; coupleNames: string; eventDate: string; uploadsOpen: boolean }
  guests: number
  photos: number
  videos: number
  messages: number
  storageBytes: number
  recentActivity: { id: string; kind: string; guestName: string; createdAt: string }[]
}

export type MemoriesGuest = {
  id: string
  name: string
  table: string | null
  photos: number
  videos: number
  messages: number
  sessions: number
  firstUpload: string | null
  lastUpload: string | null
  lastSeenAt: string
  createdAt: string
  latestThumb?: { type: string; mediaId?: string; thumbUrl: string | null; url: string | null } | null
}

export type MemoriesDownloadItem = {
  id: string
  type: string
  filename: string
  url: string
}

export type MemoriesMediaPage = {
  items: {
    id: string
    type: string
    guestName: string
    guestId: string
    caption: string | null
    createdAt: string
    isFavorite: boolean
    isHidden: boolean
    fileSize: number
    thumbUrl: string | null
    url: string | null
  }[]
  page: number
  pageSize: number
  total: number
  hasMore: boolean
}

export type MemoriesMessage = {
  id: string
  guestName: string
  message: string
  createdAt: string
  isFavorite: boolean
  isArchived: boolean
}

export type MemoriesMediaAction = 'favorite' | 'unfavorite' | 'hide' | 'unhide' | 'delete'
export type MemoriesMessageAction = 'favorite' | 'unfavorite' | 'archive' | 'unarchive' | 'delete'

export type AdminStory = {
  id: string
  mediaType: 'photo' | 'video'
  duration: number
  configuredDuration: number | null
  sortOrder: number
  isActive: boolean
  status: string
  startsAt: string | null
  expiresAt: string | null
  createdAt: string
  fileSize: number
  thumbUrl: string | null
  views: number
  uniqueViewers: number
}

export type AdminNotification = {
  id: string
  eventId: string
  kind: 'attending' | 'not_attending' | 'updated' | 'message' | 'opened'
  createdAt: string
  guestId: string
  guestName: string
  title: string
  body: string
  guestCount: number | null
  message: string | null
  href: string
}

export type AdminGuest = {
  id: string
  fullName: string
  titleKey: string | null
  includeFamily: boolean
  familySuffixKey: string | null
  displayName: string
  phoneNumber: string | null
  email: string | null
  language: Language
  inviteToken: string
  inviteUrl: string
  isActive: boolean
  inviteSent: boolean
  inviteSentAt: string | null
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
