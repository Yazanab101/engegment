import { useEffect } from 'react'
import { playEngagementPiano, playRevealShimmer } from '../lib/audio'
import { REVEAL } from '../components/invitationReveal'

/** Footer is the last reveal transition — delay + duration in seconds. */
export const ENGAGEMENT_PIANO_DELAY_MS =
  (REVEAL.frontFlowers + 0.35 + 0.95) * 1000

export function useInvitationAudio(): void {
  useEffect(() => {
    playRevealShimmer()

    const pianoTimer = window.setTimeout(playEngagementPiano, ENGAGEMENT_PIANO_DELAY_MS)
    return () => window.clearTimeout(pianoTimer)
  }, [])
}
