import { useEffect, useRef, useState } from 'react'
import type { Scaffolds } from '../../types'

/// How long a steer change rests before it acts. Long enough that dragging
/// through a dropdown is one regeneration rather than one per option.
const STEER_SETTLE_MS = 300

const EMPTY: Scaffolds = { replies: [], frames: [], starters: [] }

interface Options {
  /// Whether settings have loaded. The first steer settle must not fire before
  /// they have, or it lands on top of the greeting.
  settingsLoaded: boolean
  level: string
  topic: string
  /// Re-open the conversation aligned to the new level or topic.
  onSteered: (change: string) => void
}

/// The suggestion chips, and what refreshes them.
///
/// Turn analysis produces suggestions. Steering requests a fresh partner reply
/// before those suggestions are generated; it must not race a standalone
/// refresh based on the previous exchange.
export function useScaffolds({
  settingsLoaded,
  level,
  topic,
  onSteered,
}: Options) {
  const [fresh, setFresh] = useState<Scaffolds | null>(null)
  const onSteeredRef = useRef(onSteered)
  onSteeredRef.current = onSteered

  // A steer change has the partner re-open the conversation. Its analysis
  // generates suggestions from the new reply, never from the old exchange. It waits for settings, then
  // records the starting values without acting: the greeting is itself the
  // first steered message, so the first settle must not double-send.
  const initialised = useRef(false)
  const lastSteer = useRef<string | null>(null)
  useEffect(() => {
    if (!settingsLoaded) return
    const key = `${level}|${topic}`
    if (!initialised.current) {
      initialised.current = true
      lastSteer.current = key
      return
    }
    // React to values, not callback identity, so rebuilding `requestTurn`
    // cannot trigger an unrelated steering turn.
    if (lastSteer.current === key) return
    lastSteer.current = key
    const timer = setTimeout(() => {
      setFresh(EMPTY)
      const change = [level ? `level: ${level}` : null, topic ? `topic: ${topic}` : null]
        .filter(Boolean)
        .join(', ')
      onSteeredRef.current(change)
    }, STEER_SETTLE_MS)
    return () => clearTimeout(timer)
  }, [level, topic, settingsLoaded])

  return {
    /// The freshest suggestions, or null if this turn produced none.
    fresh,
    setFresh,
    /// What the chips should show: steer-driven suggestions win, then the
    /// best any turn produced, then nothing.
    chipsFrom: (best: Scaffolds | null): Scaffolds => fresh ?? best ?? EMPTY,
  }
}
