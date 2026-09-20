import {
  PHOTO_STORY_DEFAULT_SECONDS,
  PHOTO_STORY_MAX_SECONDS,
  PHOTO_STORY_MIN_SECONDS,
  STORY_MAX_SECONDS,
  type StoryMediaType,
  type StoryRingState,
} from './story-config'

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

export function mergeViewedIds(serverIds: string[] | undefined, localIds: string[] | undefined) {
  return [...new Set([...(serverIds ?? []), ...(localIds ?? [])])]
}
