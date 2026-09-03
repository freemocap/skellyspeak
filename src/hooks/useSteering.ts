import { useCallback, useState } from 'react'

// Conversation steering: level feeds the CEFR in every prompt; topic steers
// the conversation when natural. Persisted per device.
export const STEER_LEVELS = [
  { value: 'zero', label: 'Absolute zero', cefr: 'PRE-A1' },
  { value: 'beginner', label: 'Beginner', cefr: 'A2' },
  { value: 'intermediate', label: 'Intermediate', cefr: 'B1' },
  { value: 'advanced', label: 'Advanced', cefr: 'C1' },
]
export const STEER_TOPICS: readonly string[] = [
  'Daily routines', 'Food & cooking', 'Travel stories', 'Work & studies',
  'Family & friends', 'Music & hobbies', 'Movies & series', 'Weekend plans',
  'Childhood memories', 'Weather & seasons', 'Sports & exercise', 'Technology',
  'Pets & animals', 'Hometown', 'Dreams & goals', 'Shopping & markets',
]

interface Steering {
  level: string
  topic: string
  setLevel: (v: string) => void
  setTopic: (v: string) => void
  randomTopic: () => void
}

export function useSteering(): Steering {
  const [level, setLevelState] = useState<string>(
    () => localStorage.getItem('skellyspeak_level') ?? 'beginner'
  )
  const [topic, setTopicState] = useState<string>(
    () => localStorage.getItem('skellyspeak_topic') ?? ''
  )
  const setLevel = useCallback((v: string) => {
    setLevelState(v)
    localStorage.setItem('skellyspeak_level', v)
  }, [])
  const setTopic = useCallback((v: string) => {
    setTopicState(v)
    localStorage.setItem('skellyspeak_topic', v)
  }, [])
  const randomTopic = useCallback(() => {
    setTopic(STEER_TOPICS[Math.floor(Math.random() * STEER_TOPICS.length)])
  }, [setTopic])
  return { level, topic, setLevel, setTopic, randomTopic }
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