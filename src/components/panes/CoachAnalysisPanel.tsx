import { useCallback, useEffect, useRef, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { invoke, isTauri } from '../../lib/tauri'
import type { CoachMessage, LessonChoices, LessonState, Profile, TeachingPlan } from '../../types'
import { AnalysisContent, type AnalysedTurn, type InspectTarget } from './AnalysisContent'
import { LessonContent, ChoiceSummary } from './LessonContent'
import type { LessonSaveResult } from './LessonEditor'
import { CoachDock } from './CoachDock'
import { Markdown } from '../../lib/markdown'

export function CoachAnalysisPanel({ level, topic, chatId, prepareContext, conversationBusy, plan, profile, observationStatus, tab, onTab, draftQuestion, onDraftConsumed, pinnedTurn, inspect, nativeLanguageName, showRomanization, rtl }: {
  prepareContext: () => Promise<void>; conversationBusy: boolean
  level: string; topic: string; chatId: string; plan: TeachingPlan | null; profile: Profile | null
  observationStatus: string; tab: 'lesson' | 'analysis'; onTab: (tab: 'lesson' | 'analysis') => void
  draftQuestion: string; onDraftConsumed: () => void; pinnedTurn: AnalysedTurn | null
  inspect: InspectTarget | null; nativeLanguageName: string; showRomanization: boolean; rtl: boolean
}) {
  const [lesson, setLesson] = useState<LessonState | null>(null)
  const [thread, setThread] = useState<CoachMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const alive = useRef(true)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  const refresh = useCallback(async () => {
    const current = await invoke<LessonState>('get_lesson')
    if (alive.current) setLesson((previous) => previous && previous.revision > current.revision ? previous : current)
  }, [])
  useEffect(() => {
    alive.current = true
    if (!isTauri) return
    void refresh().catch((e: unknown) => { if (alive.current) setError(String(e)) })
    void invoke<CoachMessage[]>('get_coach_thread').then((messages) => { if (alive.current) setThread(messages) }).catch((e: unknown) => { if (alive.current) setError(String(e)) })
    const subscription = listen('lesson-changed', () => { void refresh().catch((e: unknown) => { if (alive.current) setError(String(e)) }) })
    void subscription.catch((e: unknown) => { if (alive.current) setError(String(e)) })
    return () => { alive.current = false; void subscription.then((unlisten) => unlisten(), () => {}) }
  }, [refresh])
  useEffect(() => {
    if (!draftQuestion) return
    setInput(draftQuestion); inputRef.current?.focus(); onDraftConsumed()
  }, [draftQuestion, onDraftConsumed])
  useEffect(() => { if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight }, [thread, busy])
  const recover = async (failure: unknown): Promise<void> => {
    if (alive.current) setError(String(failure))
    try { await refresh() } catch (e) { if (alive.current) setError(`${String(failure)}\nCannot refresh lesson: ${String(e)}`) }
  }
  const save = async (choices: LessonChoices, revision: number): Promise<LessonSaveResult> => {
    setBusy(true); setError(null)
    try {
      const saved = await invoke<LessonState>('save_lesson', { chatId, expectedRevision: revision, choices })
      if (alive.current) setLesson((previous) => previous && previous.revision > saved.revision ? previous : saved)
      return { lesson: saved }
    } catch (e) { await recover(e); return { error: String(e) } }
    finally { if (alive.current) setBusy(false) }
  }
  const ask = async (): Promise<void> => {
    const question = input.trim()
    if (!question || busy || conversationBusy || !lesson) return
    setBusy(true); setError(null)
    try {
      await prepareContext()
      if (!alive.current) return
      const result = await invoke<{ reply: string; proposal: LessonChoices | null; lesson: LessonState }>('coach_ask', { question, chatId, level, topic, expectedRevision: lesson.revision })
      if (!alive.current) return
      setThread((messages) => [...messages, { role: 'user', content: question, proposal: null, lesson_revision: null }, { role: 'coach', content: result.reply, proposal: result.proposal, lesson_revision: result.lesson.revision }])
      setLesson((previous) => previous && previous.revision > result.lesson.revision ? previous : result.lesson); setInput('')
    } catch (e) { await recover(e) }
    finally { if (alive.current) setBusy(false) }
  }
  const clearThread = async (): Promise<void> => {
    if (busy || conversationBusy) return
    setBusy(true); setError(null)
    try {
      await invoke('coach_thread_clear')
      if (alive.current) setThread([])
    } catch (e) { if (alive.current) setError(String(e)) }
    finally { if (alive.current) setBusy(false) }
  }
  const draft = (question: string): void => { setInput(question); inputRef.current?.focus() }
  return <>
    <div className="panel-tabs" role="tablist" aria-label="Learning panel">
      <button type="button" role="tab" aria-selected={tab === 'lesson'} className={`panel-tab ${tab === 'lesson' ? 'active' : ''}`} onClick={() => onTab('lesson')}>Lesson</button>
      <button type="button" role="tab" aria-selected={tab === 'analysis'} className={`panel-tab ${tab === 'analysis' ? 'active' : ''}`} onClick={() => onTab('analysis')}>Analysis</button>
    </div>
    {tab === 'lesson' ? <>{lesson ? <LessonContent chatId={chatId} level={level} lesson={lesson} plan={plan} profile={profile} busy={busy || conversationBusy} observationStatus={observationStatus} onSave={save} onAsk={draft} /> : <p className="center-note">Loading lesson choices…</p>}</> : <div className="analysis-scroll">{pinnedTurn ? <AnalysisContent turn={pinnedTurn} inspect={inspect} nativeLanguageName={nativeLanguageName} showRomanization={showRomanization} rtl={rtl} /> : <p className="center-note">Select a partner reply to see its breakdown.</p>}</div>}
    <CoachDock actions={<button type="button" aria-label="Clear coach thread" disabled={busy || conversationBusy || thread.length === 0} onClick={() => { void clearThread() }}>Clear thread</button>}>
    <div className="coach-thread lesson-thread" ref={threadRef} aria-label="Coach conversation" aria-live="polite">
      {thread.length === 0 && <p className="lesson-meta">Ask why we’re practising something, request a change, or ask about a message. Explicit requests update your lesson; suggestions wait for you.</p>}
      {thread.map((message, i) => {
        const applied = lesson?.changes.some((change) => change.revision === (message.lesson_revision ?? -2) + 1 && JSON.stringify(change.after) === JSON.stringify(message.proposal)) ?? false
        return <div key={i} className={`coach-msg ${message.role}`}><Markdown text={message.content} onTerm={(term) => draft(`[[${term}]]`)} />
        {message.proposal && <div className="lesson-proposal"><strong>{applied ? 'Suggestion applied' : 'Suggested change · not applied'}</strong><ChoiceSummary choices={message.proposal} /><button className="lesson-action" type="button" disabled={busy || applied || !lesson || message.lesson_revision !== lesson.revision} onClick={() => { if (message.proposal && message.lesson_revision !== null) void save(message.proposal, message.lesson_revision) }}>Apply suggestion</button>{lesson && !applied && message.lesson_revision !== lesson.revision && <p className="lesson-meta">The lesson has changed since this suggestion. Ask the coach for a fresh proposal.</p>}</div>}
      </div>})}
      {busy && <p role="status" className="lesson-meta">Working…</p>}
    </div>
    {error && <div className="turn-errors" role="alert">{error}</div>}
    <form className="coach-input-row" onSubmit={(e) => { e.preventDefault(); void ask() }}>
      <textarea ref={inputRef} className="coach-input" rows={2} onKeyDown={event => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
          event.preventDefault()
          event.currentTarget.form?.requestSubmit()
        }
      }} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about the lesson, or tell the coach what to change…" aria-label="Message your coach" disabled={!isTauri || busy} />
      <button type="submit" className="coach-send" aria-label="Send to coach" disabled={!lesson || !input.trim() || busy || conversationBusy}>↑</button>
    </form>
    </CoachDock>
  </>
}
