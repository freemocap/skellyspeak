import { useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from 'react'
import { DraftAssistanceContext } from './PracticeContext'
import { TopicNotesContext } from './TopicNotesProvider'

export function TopicExplanation({ chatId, topic, level, busy }: { chatId: string; topic: string; level: string; busy: boolean }) {
  const practice = useContext(DraftAssistanceContext)
  const resource = useContext(TopicNotesContext)
  if (!resource) throw new Error('Topic explanations require their resource provider')
  const request = useMemo(() => ({ chatId, topic, level }), [chatId, topic, level])
  const subscribe = useCallback((listener: () => void) => resource.subscribe(request, listener), [resource, request])
  const snapshot = useCallback(() => resource.snapshot(request), [resource, request])
  const current = useSyncExternalStore(subscribe, snapshot)
  useEffect(() => {
    // The shared resource records errors for every subscriber to display.
    if (current.status === 'idle') void resource.read(request).then(() => {}, () => {})
  }, [resource, request, current.status])
  return <div className="lesson-topic-note">{current.status === 'ready' ? <><p>{current.note.explanation}</p><p className="lesson-example" dir="auto">{current.note.example}</p><p className="lesson-example-translation" dir="auto">{current.note.translation}</p>{practice && <button className="lesson-inline-action" disabled={busy} onClick={() => practice.useExample(current.note.example, 'suggestion')}>Use this example</button>}</> : current.status === 'error' ? <p role="alert">{current.error} <button className="lesson-inline-action" onClick={() => resource.retry(request)}>Retry</button></p> : <p className="lesson-meta" role="status">Loading explanation…</p>}</div>
}
