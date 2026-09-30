import { useCallback, useEffect, useRef, useState } from 'react'
import type { StoredTurn } from '../../../types'

/** A message from the moment the learner sends it until native storage has it:
 * while its recording is transcribed, while it is sent, or after it failed.
 * Display-only: nothing is written to conversation data, so a failure cannot
 * leave a saved message behind. `editing` names the turn an edit replaces. */
export interface PendingMessage {
  key: string
  editing: { id: number; turnId: string } | null
  text: string | null
  phase: 'transcribing' | 'sending' | 'failed'
  failure: string | null
  retry: (() => Promise<void>) | null
  /** Turns that existed when it was sent; its own turn is the first new one. */
  known: ReadonlySet<string>
}

type Held = Pick<PendingMessage, 'key' | 'editing' | 'text' | 'phase'>

/** One pending message at a time, let go once its turn lands: for an edit, the
 * turn that replaces the edited one; otherwise the first learner turn that was
 * not there when it was sent. Holding it again under the same key (a recording's
 * text arriving, or Retry) keeps its bubble. */
export function usePendingMessage(turns: readonly StoredTurn[]) {
  const [message, setMessage] = useState<PendingMessage | null>(null)
  const current = useRef(turns)
  current.current = turns
  const hold = useCallback((next: Held) => {
    const known = new Set(current.current.flatMap(turn => turn.turnId ? [turn.turnId] : []))
    setMessage({ ...next, failure: null, retry: null, known })
  }, [])
  const fail = useCallback((key: string, failure: string, retry: () => Promise<void>) =>
    setMessage(message => message?.key === key ? { ...message, phase: 'failed', failure, retry } : message), [])
  const release = useCallback((key?: string) => setMessage(message => key === undefined || message?.key === key ? null : message), [])
  const landed = message?.phase === 'sending' && turns.some(turn => message.editing
    ? turn.replacesTurnId === message.editing.turnId
    : turn.user !== null && !turn.replacedBy && turn.turnId !== undefined && !message.known.has(turn.turnId))
  useEffect(() => { if (landed) setMessage(null) }, [landed])
  return { message: landed ? null : message, hold, fail, release }
}
