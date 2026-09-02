import type { Actor } from '../types'

// Shared actor presentation. Two agents exist — chat and coach — and
// everything else runs on the Runner (deterministic Rust, not an agent).
// Colours come from the app's existing dark-layer palette so the graph and
// the run list read as one surface.

export function actorLabel(actor: Actor): string {
  return actor.type === 'agent' ? actor.id : 'runner'
}

export function actorColor(actor: Actor): string {
  if (actor.type !== 'agent') return 'var(--mut-d)'
  return actor.id === 'chat' ? 'var(--amber)' : 'var(--steel)'
}
