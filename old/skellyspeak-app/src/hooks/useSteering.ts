import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '../lib/tauri'

export const STEER_LEVELS = [
  { value: 'zero', label: 'Absolute zero', cefr: 'PRE-A1' },
  { value: 'beginner', label: 'Beginner', cefr: 'A2' },
  { value: 'intermediate', label: 'Intermediate', cefr: 'B1' },
  { value: 'advanced', label: 'Advanced', cefr: 'C1' },
  { value: 'fluent', label: 'Fluent', cefr: 'C2' },
]
export const STEER_TOPICS: readonly string[] = [
  'Daily routines', 'Food & cooking', 'Travel stories', 'Work & studies',
  'Family & friends', 'Music & hobbies', 'Movies & series', 'Weekend plans',
  'Childhood memories', 'Weather & seasons', 'Sports & exercise', 'Technology',
  'Pets & animals', 'Hometown', 'Dreams & goals', 'Shopping & markets',
]

/// The id meaning "somebody different each conversation". Must match
/// `personas::SURPRISE` in the core, which resolves it from the chat id.
export const SURPRISE_PERSONA = 'surprise'

export interface ConversationPractice {
  revision: number
  difficulty: 'zero' | 'beginner' | 'intermediate' | 'advanced' | 'fluent'
}

export function usePersonaPreference() {
  const [persona, setPersonaState] = useState(() => localStorage.getItem('skellyspeak_persona') ?? SURPRISE_PERSONA)
  const setPersona = useCallback((value: string) => {
    localStorage.setItem('skellyspeak_persona', value)
    setPersonaState(value)
  }, [])
  return { persona, setPersona }
}

export function useSteering(target: string | null, native: string | null, chatId: string | null) {
  const scope = JSON.stringify([target, native, chatId])
  const currentScope = useRef(scope)
  currentScope.current = scope
  const [loaded, setLoaded] = useState<{ scope: string; practice: ConversationPractice } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const pending = useRef(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    setError(null)
    setLoaded(null)
    if (target && native && chatId) {
      void invoke<ConversationPractice>('get_conversation_practice', { target, native, chatId }).then(practice => {
        if (active) setLoaded({ scope, practice })
      }).catch((failure: unknown) => { if (active) setError(String(failure)) })
    }
    return () => { active = false }
  }, [target, native, chatId, scope, revision])
  const practice = loaded?.scope === scope ? loaded.practice : null
  const ready = practice !== null && !saving && error === null
  const setLevel = useCallback(async (value: string) => {
    if (!STEER_LEVELS.some(level => level.value === value)) throw new Error(`Unknown challenge level: ${value}`)
    if (!ready || !practice || pending.current) throw new Error('Conversation settings are not ready for editing.')
    pending.current = true
    setSaving(true)
    try {
      const result = await invoke<ConversationPractice>('save_conversation_practice', { target, native, chatId, expectedRevision: practice.revision, difficulty: value })
      if (currentScope.current === scope) setLoaded({ scope, practice: result })
    } catch (failure) {
      if (currentScope.current === scope) setRevision(value => value + 1)
      throw failure
    } finally { pending.current = false; setSaving(false) }
  }, [target, native, chatId, practice, ready, scope])
  const [topic, setTopicState] = useState(() => localStorage.getItem('skellyspeak_topic') ?? '')
  const setTopic = useCallback((value: string) => {
    localStorage.setItem('skellyspeak_topic', value)
    setTopicState(value)
  }, [])
  const randomTopic = useCallback(() => setTopic(STEER_TOPICS[Math.floor(Math.random() * STEER_TOPICS.length)]), [setTopic])
  return { ready, error, level: practice?.difficulty ?? '', topic, setLevel, setTopic, randomTopic, reload: () => setRevision(value => value + 1) }
}

export function usePersistentToggle(key: string, defaultOpen: boolean) {
  const [open, setOpen] = useState<boolean>(() => {
    const v = localStorage.getItem(key)
    return v === null ? defaultOpen : v !== 'closed'
  })
  const toggle = useCallback(() => {
    setOpen((o) => {
      localStorage.setItem(key, o ? 'closed' : 'open')
      return !o
    })
  }, [key])
  return { open, toggle }
}

// Module-scoped so remounts (HMR, tab switches) can never re-fire the
// greeting pipeline.
let sessionGreeted = false
export function armGreeting(): boolean {
  if (sessionGreeted) return false
  sessionGreeted = true
  return true
}
export function disarmGreeting(): void {
  sessionGreeted = false
}
