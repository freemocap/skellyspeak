import { useI18n } from '../../components/i18n'
import { ErrorDetails } from '../../components/ErrorDetails'
import { ActivityIndicator } from '../../components/ActivityIndicator'
import { ConversationProgress } from './ConversationProgress'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { isTauri } from '../../platform/ipc/tauri'
import { executeAction, nativeError, readWorkspace } from '../../platform/ipc/workspace'
import { useConversationSnapshot } from './useConversationSnapshot'
import { type AnalysedTurn, type InspectTarget } from './AnalysisContent'
import { Markdown } from '../../components/Markdown'

export function CoachAnalysisPanel({ chatId, conversationBusy, tab, onTab, draftQuestion, onDraftConsumed, personaProfile, coachingContent, onLesson, lessonSummary, mysteryPartner = false, lessonContext }: {
  lessonContext?: import('../../generated/contracts').LessonView
  mysteryPartner?: boolean
  onLesson?: () => void
  lessonSummary?: import('../../generated/contracts').LessonView
  coachingContent?: ReactNode
  conversationBusy: boolean; chatId: string; personaProfile: ReactNode; tab: 'lesson' | 'evidence' | 'profile'; onTab: (tab: 'lesson' | 'evidence' | 'profile') => void
  draftQuestion: string; onDraftConsumed: () => void; pinnedTurn: AnalysedTurn | null
  inspect: InspectTarget | null; nativeLanguageName: string; showRomanization: boolean; rtl: boolean
}) {
  const tr = useI18n()
  const { snapshot, readError, retryRead } = useConversationSnapshot(isTauri ? chatId : null)
  const [input, setInput] = useState('')
  useEffect(() => { if (!mysteryPartner && tab === 'profile') onTab('lesson') }, [mysteryPartner, tab, onTab])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const generation = useRef(0)
  const sending = useRef(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const current = ++generation.current
    setInput(''); setError(null); setSubmitting(false); sending.current = false
    return () => { if (generation.current === current) generation.current++ }
  }, [chatId])
  useEffect(() => {
    if (!draftQuestion) return
    onTab('lesson'); setInput(draftQuestion); requestAnimationFrame(() => inputRef.current?.focus()); onDraftConsumed()
  }, [draftQuestion, onDraftConsumed])
  const currentSnapshot = snapshot?.conversationId === chatId ? snapshot : null
  const thread = currentSnapshot?.coachMessages.filter(message => !lessonContext || lessonContext.coachTurnIds.includes(message.turnId)) ?? []
  const coachTurns = currentSnapshot?.turns.filter(turn => turn.operations.some(operation => operation.kind === 'coach_reply') && (!lessonContext || lessonContext.coachTurnIds.includes(turn.id))) ?? []
  const running = coachTurns.some(turn => turn.state === 'pending' || turn.state === 'assisting')
  const busy = submitting || running
  const lastCoachTurn = coachTurns[0]
  const executionError = lastCoachTurn?.hold?.message ?? (lastCoachTurn?.state === 'failed' || lastCoachTurn?.state === 'unknown_outcome'
    ? lastCoachTurn.attempts.filter(attempt => attempt.error).at(-1)?.error ?? 'Coach request failed. Open AI activity for details.' : null)
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
      if (lessonContext) await executeAction(currentSnapshot, { kind: 'askLessonCoach', conversationId: chatId, lessonId: lessonContext.id, text: question, expectedRevision: currentSnapshot.revision })
      else await executeAction(workspace, { kind: 'askCoach', conversationId: chatId, text: question, expectedRevision: conversation.revision })
      if (generation.current === current) setInput('')
    } catch (failure) {
      if (generation.current === current) setError(nativeError(failure))
    } finally {
      if (generation.current === current) { sending.current = false; setSubmitting(false) }
    }
  }
  const draft = (question: string): void => { setInput(question); inputRef.current?.focus() }
  const coachDock = <div className="study-coaching" hidden={tab !== 'lesson'}>
    <div className="study-coaching-scroll">{tab === 'lesson' && !lessonContext && coachingContent}
    <div className="coach-thread lesson-thread" ref={threadRef} aria-label={tr("Coach conversation")} aria-live="polite">
      {thread.map(message => <div key={message.id} className={`coach-msg ${message.role === 'user' ? 'user' : 'coach'}`}><Markdown text={message.text} onTerm={term => draft(`[[${term}]]`)} /></div>)}
      {busy && <ActivityIndicator compact label={tr("Coach replying…")} />}
    </div>
    </div>
    {readError && <div role="alert"><p>{tr("Conversation updates stopped.")} {readError}</p><button type="button" onClick={retryRead}>{tr("Retry reading conversation")}</button></div>}
    {(error || executionError) && <ErrorDetails label={tr("Coach")} errorKey={`${lastCoachTurn?.id}:${error || executionError}`}>{error || executionError}</ErrorDetails>}
    <form className="coach-input-row" onSubmit={event => { event.preventDefault(); void ask() }}>
      <textarea ref={inputRef} className="coach-input" rows={2} onKeyDown={event => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
          event.preventDefault(); event.currentTarget.form?.requestSubmit()
        }
      }} value={input} onChange={event => setInput(event.target.value)} placeholder={tr("Ask about a message or language usage…")} aria-label={tr("Message your coach")} disabled={!isTauri || busy} />
      <button type="submit" className="coach-send" aria-label={tr("Send to coach")} disabled={!currentSnapshot || !input.trim() || busy || conversationBusy}>↑</button>
    </form>
  </div>
  return <>
    <div className="panel-tabs" role="tablist" aria-label={tr("Learning panel")}>
      <button type="button" role="tab" aria-selected={tab === 'lesson'} className={`panel-tab ${tab === 'lesson' ? 'active' : ''}`} onClick={() => onTab('lesson')}>{tr("Coaching")}</button>
      <button type="button" role="tab" aria-selected={tab === 'evidence'} className={`panel-tab ${tab === 'evidence' ? 'active' : ''}`} onClick={() => onTab('evidence')}>{tr("Evidence")}</button>
      {mysteryPartner && <button type="button" role="tab" aria-selected={tab === 'profile'} className={`panel-tab ${tab === 'profile' ? 'active' : ''}`} onClick={() => onTab('profile')}>{tr("Persona")}</button>}
    </div>
    <div className="analysis-scroll" hidden={tab !== 'profile'}>{personaProfile}</div>
    {tab === 'evidence' && <ConversationProgress chatId={chatId} />}
    {coachDock}
    {onLesson && <div className="lesson-entry"><button type="button" onClick={onLesson}>{tr("Take a lesson")}</button></div>}
    {lessonSummary && <button className="lesson-coach-summary" type="button" onClick={onLesson}><span dir="auto">{lessonSummary.plan?.title}</span>{lessonSummary.recap && <span dir="auto">{lessonSummary.recap.text}</span>}{lessonSummary.error && <span role="alert">{lessonSummary.error}</span>}</button>}
  </>
}
