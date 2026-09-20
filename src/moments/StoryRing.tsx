import type { StoryRingState } from './story-config'

export function StoryRing({
  state,
  label,
  onOpen,
  children,
}: {
  state: StoryRingState
  label?: string
  onOpen?: () => void
  children: React.ReactNode
}) {
  const tappable = state !== 'none' && Boolean(onOpen)
  const Wrapper = tappable ? 'button' : 'div'

  return (
    <Wrapper
      type={tappable ? 'button' : undefined}
      onClick={tappable ? onOpen : undefined}
      aria-label={label}
      className={`story-ring-wrap${tappable ? ' story-ring-tappable' : ''}`}
    >
      <span className={`story-ring${state !== 'none' ? ` story-ring-${state}` : ''}`}>
        {state !== 'none' ? <span className="story-ring-halo" aria-hidden /> : null}
        <span className="story-ring-inner">{children}</span>
      </span>
      {label && state !== 'none' ? <span className="story-ring-label">{label}</span> : null}
    </Wrapper>
  )
}
