/** Couple story playback and storage rules. Safe to import from client and server. */

export const STORY_MAX_SECONDS = 30
export const PHOTO_STORY_DEFAULT_SECONDS = 7
export const PHOTO_STORY_MIN_SECONDS = 5
export const PHOTO_STORY_MAX_SECONDS = 10

export type StoryMediaType = 'photo' | 'video'
export type StoryRingState = 'none' | 'unseen' | 'seen'
export type StoryExpireMode = 'event_day' | 'none' | 'custom'
