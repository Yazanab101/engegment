export type MemoryEvent = {
  id: string
  coupleNames: string
  eventDate: string
  uploadsOpen: boolean
  gallery: { id: string; url: string; type: string }[]
}

export type MemoryGuestState = {
  guest: { id: string; displayName: string } | null
  stats: { photos: number; videos: number; messages: number } | null
  media: {
    id: string
    type: string
    caption: string | null
    createdAt: string
    thumbUrl: string | null
    url: string | null
  }[]
  messages: { id: string; message: string; createdAt: string }[]
}

export type GuestStory = {
  id: string
  mediaType: 'photo' | 'video'
  duration: number
  createdAt: string
  viewed: boolean
}

export type GuestStoryFeed = {
  eventId: string
  coupleNames: string
  eventDate: string
  ring: 'none' | 'unseen' | 'seen'
  viewedIds: string[]
  stories: GuestStory[]
}

async function request<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const { timeoutMs = 12_000, ...rest } = init ?? {}
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(path, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(rest.headers ?? {}),
      },
      ...rest,
      signal: rest.signal ?? controller.signal,
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string }
      const err = new Error(body.code || body.error || 'REQUEST_FAILED') as Error & { code?: string }
      err.code = body.code || body.error
      throw err
    }
    return (await res.json()) as T
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out')
    }
    throw err
  } finally {
    window.clearTimeout(timeoutId)
  }
}

export const memoriesApi = {
  event: () => request<MemoryEvent>('/api/media/event'),
  me: (deviceToken: string) =>
    request<MemoryGuestState>('/api/media/me', {
      method: 'POST',
      body: JSON.stringify({ deviceToken }),
    }),
  identify: (deviceToken: string, name: string, table: string | null) =>
    request<{ id: string; displayName: string }>('/api/media/identify', {
      method: 'POST',
      body: JSON.stringify({ deviceToken, name, table }),
    }),
  finalize: (deviceToken: string, mediaIds: string[], caption: string | null) =>
    request('/api/media/finalize', {
      method: 'POST',
      body: JSON.stringify({ deviceToken, mediaIds, caption }),
    }),
  caption: (deviceToken: string, mediaId: string, caption: string) =>
    request(`/api/media/${mediaId}`, {
      method: 'PATCH',
      body: JSON.stringify({ deviceToken, caption }),
    }),
  remove: (deviceToken: string, mediaId: string) =>
    request(`/api/media/${mediaId}`, {
      method: 'DELETE',
      body: JSON.stringify({ deviceToken }),
    }),
  message: (deviceToken: string, message: string) =>
    request('/api/media/message', {
      method: 'POST',
      body: JSON.stringify({ deviceToken, message }),
    }),
  saveThumb: (deviceToken: string, mediaId: string, image: string) =>
    request('/api/media/thumbnail', {
      method: 'POST',
      body: JSON.stringify({ deviceToken, mediaId, image }),
    }).catch(() => undefined),
  stories: (deviceToken: string) =>
    request<GuestStoryFeed>('/api/media/stories', {
      method: 'POST',
      body: JSON.stringify({ deviceToken }),
    }),
  storySignedUrl: (deviceToken: string, storyId: string) =>
    request<{ url: string; thumbUrl: string | null; mediaType: 'photo' | 'video'; expiresIn: number }>(
      '/api/media/stories/signed-url',
      {
        method: 'POST',
        body: JSON.stringify({ deviceToken, storyId }),
      },
    ),
  storyView: (deviceToken: string, storyId: string) =>
    request<GuestStoryFeed>('/api/media/stories/view', {
      method: 'POST',
      body: JSON.stringify({ deviceToken, storyId }),
    }),
}
