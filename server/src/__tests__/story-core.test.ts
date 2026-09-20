import { describe, expect, it } from 'vitest'
import {
  clampPhotoDuration,
  isStoryVisibleToGuests,
  playbackDurationSeconds,
  ringState,
} from '../memories/story-core.js'

describe('story playback', () => {
  it('defaults photos to 7 seconds and clamps 5–10', () => {
    expect(clampPhotoDuration(null)).toBe(7)
    expect(clampPhotoDuration(3)).toBe(5)
    expect(clampPhotoDuration(12)).toBe(10)
  })

  it('caps video playback at 30 seconds', () => {
    expect(playbackDurationSeconds({ mediaType: 'video', mediaDuration: 20 })).toBe(20)
    expect(playbackDurationSeconds({ mediaType: 'video', mediaDuration: 60 })).toBe(30)
  })

  it('hides expired and unpublished stories', () => {
    expect(
      isStoryVisibleToGuests(
        { isActive: true, status: 'ready', startsAt: null, expiresAt: '2000-01-01T00:00:00.000Z' },
        new Date('2026-09-20T12:00:00.000Z'),
      ),
    ).toBe(false)
    expect(
      isStoryVisibleToGuests(
        { isActive: true, status: 'ready', startsAt: null, expiresAt: null },
        new Date('2026-09-20T12:00:00.000Z'),
      ),
    ).toBe(true)
  })

  it('computes unseen then seen ring states', () => {
    expect(ringState([], [])).toBe('none')
    expect(ringState(['a'], [])).toBe('unseen')
    expect(ringState(['a', 'b'], ['a', 'b'])).toBe('seen')
  })
})
