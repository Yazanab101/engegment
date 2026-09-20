import {
  IMAGE_MAX_BYTES,
  VIDEO_MAX_BYTES,
  UploadError,
  classifyMime,
  type MediaKind,
} from './upload-config.js'
import {
  PHOTO_STORY_DEFAULT_SECONDS,
  PHOTO_STORY_MAX_SECONDS,
  PHOTO_STORY_MIN_SECONDS,
  STORY_MAX_SECONDS,
  type StoryExpireMode,
  type StoryMediaType,
  type StoryRingState,
} from './story-config.js'

export type StoryVisibilityInput = {
  isActive: boolean
  status: string
  startsAt: string | Date | null
  expiresAt: string | Date | null
}

export function clampPhotoDuration(seconds: number | null | undefined) {
  if (seconds == null) return PHOTO_STORY_DEFAULT_SECONDS
  const value = Number(seconds)
  if (!Number.isFinite(value) || value <= 0) return PHOTO_STORY_DEFAULT_SECONDS
  return Math.min(PHOTO_STORY_MAX_SECONDS, Math.max(PHOTO_STORY_MIN_SECONDS, Math.round(value)))
}

export function playbackDurationSeconds(input: {
  mediaType: StoryMediaType
  configuredDuration?: number | null
  mediaDuration?: number | null
}) {
  if (input.mediaType === 'photo') {
    return clampPhotoDuration(input.configuredDuration ?? PHOTO_STORY_DEFAULT_SECONDS)
  }
  const actual = Number(input.mediaDuration)
  const fallback = Number(input.configuredDuration)
  const source =
    Number.isFinite(actual) && actual > 0
      ? actual
      : Number.isFinite(fallback) && fallback > 0
        ? fallback
        : STORY_MAX_SECONDS
  return Math.min(STORY_MAX_SECONDS, source)
}

export function endOfEventDay(eventDate: string, now = new Date()) {
  const match = String(eventDate).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return new Date(`${match[1]}-${match[2]}-${match[3]}T23:59:59.999+03:00`)
  }
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  return end
}

export function resolveExpiresAt(input: {
  mode: StoryExpireMode
  eventDate: string
  custom?: string | null
  now?: Date
}) {
  if (input.mode === 'none') return null
  if (input.mode === 'custom') {
    if (!input.custom) return null
    const parsed = new Date(input.custom)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return endOfEventDay(input.eventDate, input.now)
}

export function isStoryVisibleToGuests(story: StoryVisibilityInput, now = new Date()) {
  if (!story.isActive || story.status !== 'ready') return false
  if (story.startsAt) {
    const start = new Date(story.startsAt)
    if (!Number.isNaN(start.getTime()) && start.getTime() > now.getTime()) return false
  }
  if (story.expiresAt) {
    const end = new Date(story.expiresAt)
    if (!Number.isNaN(end.getTime()) && end.getTime() <= now.getTime()) return false
  }
  return true
}

export function ringState(activeIds: string[], viewedIds: Iterable<string>): StoryRingState {
  if (!activeIds.length) return 'none'
  const viewed = new Set(viewedIds)
  return activeIds.every((id) => viewed.has(id)) ? 'seen' : 'unseen'
}

export function firstUnseenIndex(activeIds: string[], viewedIds: Iterable<string>) {
  const viewed = new Set(viewedIds)
  const index = activeIds.findIndex((id) => !viewed.has(id))
  return index < 0 ? 0 : index
}

export function buildStoryObjectKeys(input: {
  eventId: string
  storyId: string
  ext: string
  hasThumb: boolean
}) {
  const base = `events/${input.eventId}/stories/${input.storyId}`
  return {
    objectKey: `${base}.${input.ext}`,
    thumbnailObjectKey: input.hasThumb ? `${base}-thumb.jpg` : null,
  }
}

export function assertStoryObjectKey(objectKey: string, eventId: string, storyId: string) {
  const prefix = `events/${eventId}/stories/${storyId}`
  if (!objectKey.startsWith(prefix) || objectKey.includes('..') || objectKey.includes('//')) {
    throw new UploadError('INVALID_OBJECT_KEY', 'Story object key is not owned by this event', 403)
  }
}

export function classifyStoryUpload(mimeType: string, fileSize: number, mediaType: MediaKind) {
  const classified = classifyMime(mimeType)
  if (!classified || classified.kind !== mediaType) {
    throw new UploadError('UNSUPPORTED_TYPE', 'This file type is not supported for stories', 400)
  }
  if (mediaType === 'photo' && fileSize > IMAGE_MAX_BYTES) {
    throw new UploadError('FILE_TOO_LARGE', 'Story photo is too large', 400)
  }
  if (mediaType === 'video' && fileSize > VIDEO_MAX_BYTES) {
    throw new UploadError('FILE_TOO_LARGE', 'Story video is too large', 400)
  }
  return classified
}

export function uniqueViewerKey(guestId: string | null | undefined, deviceId: string | null | undefined) {
  if (guestId) return `guest:${guestId}`
  if (deviceId) return `device:${deviceId}`
  return null
}

export function mergeViewedIds(serverIds: string[] | undefined, localIds: string[] | undefined) {
  return [...new Set([...(serverIds ?? []), ...(localIds ?? [])])]
}
