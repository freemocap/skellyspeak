import { ErrorDetails } from '../ErrorDetails'
import { ActivityIndicator } from '../ActivityIndicator'
import { DetailDialog } from '../DetailDialog'
import { ConversationProgress } from './ConversationProgress'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { isTauri } from '../../lib/tauri'
import { executeAction, nativeError, readWorkspace, watchConversation } from '../../lib/workspace'
import type { ConversationSnapshot } from '../../contracts'
import { type AnalysedTurn, type InspectTarget } from './AnalysisContent'
import { CoachDock } from './CoachDock'
import { Markdown } from '../../lib/markdown'

export function CoachAnalysisPanel({ chatId, conversationBusy, tab, onTab, draftQuestion, onDraftConsumed, contactProfile }: {
  conversationBusy: boolean; chatId: string; contactProfile: ReactNode; tab: 'lesson' | 'profile'; onTab: (tab: 'lesson' | 'profile') => void
  draftQuestion: string; onDraftConsumed: () => void; pinnedTurn: AnalysedTurn | null
  inspect: InspectTarget | null; nativeLanguageName: string; showRomanization: boolean; rtl: boolean
}) {
  const [snapshot, setSnapshot] = useState<ConversationSnapshot | null>(null)
  const [input, setInput] = useState('')
  const [coachOpen, setCoachOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const generation = useRef(0)
  const sending = useRef(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const current = ++generation.current
    setSnapshot(null); setInput(''); setError(null); setSubmitting(false); sending.current = false
    if (!isTauri || !chatId) return
    let stopped = false
    void (async () => {
      let revision = -1
      while (!stopped) {
        const next = await watchConversation(chatId, revision)
        if (stopped) return
        setSnapshot(next)
        revision = next.revision
      }
    })().catch((failure: unknown) => {
      if (!stopped) setError(nativeError(failure))
    })
    return () => { stopped = true; if (generation.current === current) generation.current++ }
  }, [chatId])
  useEffect(() => {
    if (!draftQuestion) return
    setCoachOpen(true); setInput(draftQuestion); inputRef.current?.focus(); onDraftConsumed()
  }, [draftQuestion, onDraftConsumed])
  const currentSnapshot = snapshot?.conversationId === chatId ? snapshot : null
  const thread = currentSnapshot?.coachMessages ?? []
  const coachTurns = currentSnapshot?.turns.filter(turn => turn.operations.some(operation => operation.kind === 'coach_reply')) ?? []
  const running = coachTurns.some(turn => turn.state === 'pending' || turn.state === 'assisting')
  const busy = submitting || running
  const lastCoachTurn = coachTurns[0]
  const executionError = lastCoachTurn?.hold?.message ?? (lastCoachTurn?.state === 'failed' || lastCoachTurn?.state === 'unknown_outcome'
    ? lastCoachTurn.attempts.filter(attempt => attempt.error).at(-1)?.error ?? 'Coach request failed. Open AI activity for details.' : null)
  useEffect(() => { if (coachOpen) inputRef.current?.focus() }, [coachOpen])
  useEffect(() => { if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight }, [thread, busy])
  const ask = async (): Promise<void> => {
    const question = input.trim()
    if (!question || sending.current || busy || conversationBusy || !currentSnapshot) return
    const current = generation.current
    sending.current = true; setSubmitting(true); setError(null)
    try {
      const workspace = await readWorkspace()
      if (generation.current !== current) return
      const conversation = workspace.conversations.find(item => item.id === chatId)
      if (!conversation || conversation.archived) throw new Error('This conversation is unavailable.')
      await executeAction(workspace, { kind: 'askCoach', conversationId: chatId, text: question, expectedRevision: conversation.revision })
      if (generation.current === current) setInput('')
    } catch (failure) {
      if (generation.current === current) setError(nativeError(failure))
    } finally {
      if (generation.current === current) { sending.current = false; setSubmitting(false) }
    }
  }
  const draft = (question: string): void => { setInput(question); inputRef.current?.focus() }
  const coachDock = <CoachDock presentation={coachOpen ? 'dialog' : 'dock'} actions={<button type="button" aria-label="Clear coach thread" disabled title="Coach thread clearing is not available yet.">Clear thread</button>}>
    <div className="coach-thread lesson-thread" ref={threadRef} aria-label="Coach conversation" aria-live="polite">
      {thread.map(message => <div key={message.id} className={`coach-msg ${message.role === 'user' ? 'user' : 'coach'}`}><Markdown text={message.text} onTerm={term => draft(`[[${term}]]`)} /></div>)}
      {busy && <ActivityIndicator compact label="Coach replying…" />}
    </div>
    {(error || executionError) && <ErrorDetails label="Coach" errorKey={`${lastCoachTurn?.id}:${error || executionError}`}>{error || executionError}</ErrorDetails>}
    <form className="coach-input-row" onSubmit={event => { event.preventDefault(); void ask() }}>
      <textarea ref={inputRef} className="coach-input" rows={2} onKeyDown={event => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
          event.preventDefault(); event.currentTarget.form?.requestSubmit()
        }
      }} value={input} onChange={event => setInput(event.target.value)} placeholder="Ask about a message or language usage…" aria-label="Message your coach" disabled={!isTauri || busy} />
      <button type="submit" className="coach-send" aria-label="Send to coach" disabled={!currentSnapshot || !input.trim() || busy || conversationBusy}>↑</button>
    </form>
  </CoachDock>
  return <>
    <div className="panel-tabs" role="tablist" aria-label="Learning panel">
      <button type="button" role="tab" aria-selected={tab === 'lesson'} className={`panel-tab ${tab === 'lesson' ? 'active' : ''}`} onClick={() => onTab('lesson')}>Skill map</button>
      <button type="button" role="tab" aria-selected={tab === 'profile'} className={`panel-tab ${tab === 'profile' ? 'active' : ''}`} onClick={() => onTab('profile')}>Persona</button>
    </div>
    <div className="analysis-scroll" hidden={tab !== 'profile'}>{contactProfile}</div>
    {tab === 'lesson' && <ConversationProgress chatId={chatId} />}
    {coachOpen ? <DetailDialog title="Coach conversation" onClose={() => setCoachOpen(false)}><h2>Coach conversation</h2>{coachDock}</DetailDialog> : coachDock}
  </>
}
