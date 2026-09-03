import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { Scaffolds, Settings } from '../../types'
import { isTauri } from '../../lib/tauri'
import { chatHistory } from '../../lib/turns'
import { usePersistentToggle } from '../../hooks/useSteering'
import type { Turn } from './useConversation'

/// How much of the conversation a scaffold refresh sends. It only needs the
/// recent exchange to suggest what to say next.
const SCAFFOLD_HISTORY_MESSAGES = 8

/// How long a steer change rests before it acts. Long enough that dragging
/// through a dropdown is one regeneration rather than one per option.
const STEER_SETTLE_MS = 300

const EMPTY: Scaffolds = { replies: [], frames: [], starters: [] }

interface Options {
  turnsRef: React.RefObject<Turn[]>
  settingsRef: React.RefObject<Settings | null>
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
/// Two things produce scaffolds: every turn's analysis pass, and an explicit
/// regeneration when the learner changes their level or topic. This owns the
/// second, plus which set the chips currently show.
export function useScaffolds({
  turnsRef,
  settingsRef,
  settingsLoaded,
  level,
  topic,
  onSteered,
}: Options) {
  const [fresh, setFresh] = useState<Scaffolds | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { open, toggle } = usePersistentToggle('skellyspeak_scaffolds', true)
  // A second regeneration while one is in flight would race it; the ref is
  // read synchronously, which the state cannot be.
  const inFlight = useRef(false)

  const onSteeredRef = useRef(onSteered)
  onSteeredRef.current = onSteered

  const regenerate = useCallback(
    async (forLevel: string, forTopic: string) => {
      if (!isTauri || inFlight.current) return
      inFlight.current = true
      setLoading(true)
      setError(null)
      try {
        const s = await invoke<Scaffolds>('generate_scaffolds', {
          req: {
            history: chatHistory(turnsRef.current ?? [], SCAFFOLD_HISTORY_MESSAGES),
            level: forLevel,
            topic: forTopic || null,
            // Read through the ref, not a closure: this callback is created
            // once, and a closure's `settings` would be the first render's —
            // still null, so the dialect never reached the prompt.
            dialect: settingsRef.current?.target_dialect || null,
          },
        })
        setFresh(s)
      } catch (e) {
        setError(String(e).replace(/^Error:\s*/, ''))
      } finally {
        inFlight.current = false
        setLoading(false)
      }
    },
    [turnsRef, settingsRef]
  )

  // A steer change regenerates the chips AND has the partner re-open the
  // conversation aligned to the new level/topic. It waits for settings, then
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
    // React to the VALUES, not to callback identity. This effect used to
    // re-run whenever `requestTurn` was rebuilt — which happens on a language
    // change — and fired a steering turn straight after the post-switch
    // greeting. That was the "it doubles the first message" bug.
    if (lastSteer.current === key) return
    lastSteer.current = key
    const timer = setTimeout(() => {
      void regenerate(level, topic)
      const change = [level ? `level: ${level}` : null, topic ? `topic: ${topic}` : null]
        .filter(Boolean)
        .join(', ')
      onSteeredRef.current(change)
    }, STEER_SETTLE_MS)
    return () => clearTimeout(timer)
  }, [level, topic, regenerate, settingsLoaded])

  return {
    /// The freshest suggestions, or null if this turn produced none.
    fresh,
    setFresh,
    loading,
    error,
    open,
    toggle,
    regenerate,
    /// What the chips should show: steer-driven suggestions win, then the
    /// best any turn produced, then nothing.
    chipsFrom: (best: Scaffolds | null): Scaffolds => fresh ?? best ?? EMPTY,
  }
}
