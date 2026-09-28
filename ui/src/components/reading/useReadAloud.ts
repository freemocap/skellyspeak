import { speechKey, useReadingActions, useReadingScope } from './ReadingContext'
import type { MessagePlay } from './MessageTools'

/** Read a span of target-language text aloud through the shared reading
 * actions, or stop it. Every read-aloud control (a message's Play, a word's
 * speaker) uses this, so one utterance plays at a time app-wide. Null when no
 * reading scope or actions are present. */
export function useReadAloud(text: string, start = 0, end = text.length): (MessagePlay & { stop: () => void }) | null {
  const actions = useReadingActions()
  const scope = useReadingScope()
  if (!actions || !scope) return null
  const selection = { text, start, end, scope }
  const playing = actions.speaking === speechKey(selection)
  return {
    playing,
    onToggle: () => { if (playing) actions.stop(); else actions.speak(selection) },
    stop: actions.stop,
  }
}
