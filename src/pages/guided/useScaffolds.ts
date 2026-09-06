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
  chatIdRef: React.RefObject<{ id: string } | null>
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
/// Turn analysis produces suggestions. Steering requests a fresh partner reply
/// before those suggestions are generated; it must not race a standalone
/// refresh based on the previous exchange.
export function useScaffolds({
  chatIdRef,
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
        const owner = chatIdRef.current
        if (!owner) throw new Error('No conversation is open.')
        const s = await invoke<Scaffolds>('generate_scaffolds', {
          req: {
            chat_id: owner.id,
            history: chatHistory(turnsRef.current ?? [], SCAFFOLD_HISTORY_MESSAGES),
            level: forLevel,
            topic: forTopic || null,
            // Read through the ref, not a closure: this callback is created
            // once, and a closure's `settings` would be the first render's —
            // still null, so the dialect never reached the prompt.
            dialect: settingsRef.current?.target_dialect || null,
          },
        })
        if (chatIdRef.current !== owner) throw new Error('The conversation changed while refreshing suggestions.')
        setFresh(s)
      } catch (e) {
        setError(String(e).replace(/^Error:\s*/, ''))
      } finally {
        inFlight.current = false
        setLoading(false)
      }
    },
    [turnsRef, settingsRef, chatIdRef]
  )

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
