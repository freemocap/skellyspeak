/// A persona is recognised by its first vibe emoji. A persona without one shows
/// an empty mark of the same size, so names stay aligned.
export function PersonaAvatar({ symbol }: { symbol: string | undefined }) {
  return <span className="persona-avatar" aria-hidden="true">{symbol ?? ''}</span>
}
