import { CoachChatLayout, type CoachChatLayoutHandle } from './CoachChatLayout'
import { CoachPanelTabs } from './CoachPanelTabs'
import { useI18n } from '../../../components/localization/i18n'
import { ErrorDetails } from '../../../components/feedback/ErrorDetails'
import { ActivityIndicator } from '../../../components/feedback/ActivityIndicator'
import { ConversationProgress } from '../progress/ConversationProgress'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { isTauri } from '../../../platform/ipc/tauri'
import { executeAction, nativeError, readWorkspace } from '../../../platform/ipc/workspace'
import { useConversationSnapshot } from '../session/useConversationSnapshot'
import { type AnalysedTurn, type InspectTarget } from '../reading/AnalysisContent'
import { Markdown } from '../../../components/reading/Markdown'

export function CoachAnalysisPanel({ chatId, conversationBusy, tab, onTab, draftQuestion, onDraftConsumed, autoSendDraft = false, coachingContent, onCollapse }: {
  autoSendDraft?: boolean
  onCollapse?: () => void
  coachingContent?: ReactNode
  conversationBusy: boolean; chatId: string; tab: 'coaching' | 'evidence'; onTab: (tab: 'coaching' | 'evidence') => void
  draftQuestion: string; onDraftConsumed: () => void; pinnedTurn: AnalysedTurn | null
  inspect: InspectTarget | null; nativeLanguageName: string; showRomanization: boolean; rtl: boolean
}) {
  const tr = useI18n()
  const { snapshot, readError, retryRead } = useConversationSnapshot(isTauri ? chatId : null)
  const [input, setInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const generation = useRef(0)
  const sending = useRef(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  const chatLayoutRef = useRef<CoachChatLayoutHandle>(null)
  useEffect(() => {
    const current = ++generation.current
    setInput(''); setError(null); setSubmitting(false); sending.current = false
    return () => { if (generation.current === current) generation.current++ }
  }, [chatId])
  const currentSnapshot = snapshot?.conversationId === chatId ? snapshot : null
  const thread = currentSnapshot?.coachMessages ?? []
  const coachTurns = currentSnapshot?.turns.filter(turn => turn.operations.some(operation => operation.kind === 'coach_reply')) ?? []
  const running = coachTurns.some(turn => turn.state === 'pending' || turn.state === 'assisting')
  const busy = submitting || running
  const lastCoachTurn = coachTurns[0]
  const executionError = lastCoachTurn?.hold?.message ?? (lastCoachTurn?.state === 'failed' || lastCoachTurn?.state === 'unknown_outcome'
    ? lastCoachTurn.attempts.filter(attempt => attempt.error).at(-1)?.error ?? 'Coach request failed. Open AI activity for details.' : null)
  useEffect(() => { if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight }, [thread, busy])
  const ask = async (text = input): Promise<void> => {
    const question = text.trim()
    if (!question || sending.current || busy || conversationBusy || !currentSnapshot) return
    chatLayoutRef.current?.expand()
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
  // External Ask actions use the same admission, revision and error path as Send.
  // Consume once before dispatch; failed submissions stay editable and never retry automatically.
  const consumedDraft = useRef<string | null>(null)
  useEffect(() => {
    if (!draftQuestion) { consumedDraft.current = null; return }
    if (consumedDraft.current === draftQuestion) return
    onTab('coaching')
    if (autoSendDraft && (sending.current || busy || conversationBusy || !currentSnapshot)) return
    consumedDraft.current = draftQuestion
    setInput(draftQuestion)
    requestAnimationFrame(() => inputRef.current?.focus())
    onDraftConsumed()
    if (autoSendDraft) void ask(draftQuestion)
  }, [draftQuestion, autoSendDraft, busy, conversationBusy, currentSnapshot, onDraftConsumed])
  const draft = (question: string): void => { setInput(question); inputRef.current?.focus() }
  const coachDock = <CoachChatLayout ref={chatLayoutRef} hidden={tab !== 'coaching'} content={tab === 'coaching' && coachingContent}
    onExpand={() => { if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight }}
    thread={<div className="coach-thread" ref={threadRef} aria-label={tr("Coach conversation")} aria-live="polite">
      {thread.length > 0 && <h3 className="coach-group-label">{tr("You asked")}</h3>}
      {thread.map(message => <div key={message.id} className={`coach-msg ${message.role === 'user' ? 'user' : 'coach'}`}><Markdown text={message.text} onTerm={term => draft(`[[${term}]]`)} /></div>)}
      {busy && <ActivityIndicator compact label={tr("Coach replying…")} />}
    </div>}
    notices={<>{readError && <div role="alert"><p>{tr("Conversation updates stopped.")} {readError}</p><button type="button" onClick={retryRead}>{tr("Retry reading conversation")}</button></div>}
    {(error || executionError) && <ErrorDetails label={tr("Coach")} errorKey={`${lastCoachTurn?.id}:${error || executionError}`}>{error || executionError}</ErrorDetails>}</>}
    composer={<form className="coach-input-row" onSubmit={event => { event.preventDefault(); void ask() }}>
      <textarea ref={inputRef} className="coach-input" rows={2} onKeyDown={event => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
          event.preventDefault(); event.currentTarget.form?.requestSubmit()
        }
      }} value={input} onChange={event => setInput(event.target.value)} placeholder={tr("Ask about a message or language usage…")} aria-label={tr("Message your coach")} disabled={!isTauri || busy} />
      <button type="submit" className="coach-send" aria-label={tr("Send to coach")} disabled={!currentSnapshot || !input.trim() || busy || conversationBusy}>↑</button>
    </form>}
  />
  return <>
    <CoachPanelTabs tab={tab} onTab={onTab} onCollapse={onCollapse} />
    {tab === 'evidence' && <ConversationProgress chatId={chatId} />}
    {coachDock}
  </>
}
