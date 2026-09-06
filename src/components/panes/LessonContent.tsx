import { useEffect, useRef, useState } from 'react'
import { invoke } from '../../lib/tauri'
import { LessonEditor, type LessonSaveResult } from './LessonEditor'
import type { LessonChoices, LessonState, Profile, TeachingPlan } from '../../types'

export function ChoiceSummary({ choices }: { choices: LessonChoices }) {
  return <><p>{choices.goal || 'Let the coach infer a practice focus'}</p>
    {choices.preferences.length > 0 && <ul>{choices.preferences.map((p, i) => <li key={i}>{p}</li>)}</ul>}
    <p className="lesson-meta">Corrections per reply: {choices.correction_budget ?? 'automatic'}</p></>
}
function Notes({ label, items }: { label: string; items: string[] }) {
  return <section><h4>{label}</h4>{items.length ? <ul>{items.map((item, i) => <li key={i}>{item}</li>)}</ul> : <p className="lesson-meta">Nothing recorded yet.</p>}</section>
}
interface TopicNote { explanation: string; example: string; translation: string }
function TopicExplanation({ chatId, topic, level, busy }: { chatId: string; topic: string; level: string; busy: boolean }) {
  const [note, setNote] = useState<TopicNote | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const request = useRef<Promise<TopicNote> | null>(null)
  useEffect(() => {
    if (busy) return
    let alive = true
    request.current ??= invoke<TopicNote>('lesson_topic_note', { chatId, topic, level })
    void request.current.then((result) => { if (alive) setNote(result) }).catch((failure: unknown) => { if (alive) setError(String(failure)) })
    return () => { alive = false }
  }, [chatId, topic, level, busy, attempt])
  return <div className="lesson-topic-note">{note ? <><p>{note.explanation}</p><p className="lesson-example" dir="auto">{note.example}</p><p className="lesson-example-translation" dir="auto">{note.translation}</p></> : error ? <p role="alert">{error} <button className="lesson-inline-action" onClick={() => { request.current = null; setError(null); setAttempt((n) => n + 1) }}>Retry</button></p> : <p className="lesson-meta" role="status">{busy ? 'Waiting for this turn…' : 'Loading explanation…'}</p>}</div>
}
export function LessonContent({ chatId, level, lesson, plan, profile, busy, observationStatus, onSave, onAsk }: {
  chatId: string; level: string; lesson: LessonState; plan: TeachingPlan | null; profile: Profile | null
  busy: boolean; observationStatus: string
  onSave: (choices: LessonChoices, revision: number) => Promise<LessonSaveResult>
  onAsk: (question: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const focus = lesson.choices.goal ? [lesson.choices.goal] : plan?.session_focus ?? []
  return <div className="lesson-content">
    <section className="lesson-focus">
      {focus.map((topic, index) => <section className="lesson-topic" key={`${chatId}:${level}:${topic}`}>
        <div className="lesson-topic-title"><span className="lesson-topic-index">{String(index + 1).padStart(2, '0')}</span><h2>{topic}</h2></div>
        <TopicExplanation chatId={chatId} topic={topic} level={level} busy={busy} />
        <div className="lesson-topic-tools">
          <button type="button" className="lesson-inline-action" disabled={busy} onClick={() => onAsk(`Help me practise ${topic}. Give me a short example at my selected practice level.`)}>Try an example</button>
          <button type="button" className="lesson-inline-action" disabled={busy} onClick={() => onAsk(`Why are we practising ${topic}? Explain what in my conversation supports this focus.`)}>Why this?</button>
        </div>
      </section>)}
      {!focus.length && <p className="lesson-empty">{plan ? 'Choose something you want to practise.' : 'Finding a starting point…'}</p>}
      <div className="lesson-focus-footer"><span>{lesson.choices.goal ? 'Your goal' : 'Coach-suggested'}</span><button type="button" className="lesson-action" disabled={busy} onClick={() => setEditing(true)}>Edit choices</button></div>
      {editing && <LessonEditor lesson={lesson} onSave={onSave} onClose={() => setEditing(false)} />}
    </section>
    <details className="lesson-background"><summary>Preferences &amp; coach memory</summary>
    <details className="lesson-section lesson-delivery"><summary><span>Partner corrections</span><span className="lesson-count">{lesson.choices.correction_budget ?? plan?.correction_budget ?? '…'} / reply</span></summary><p>{lesson.choices.correction_budget === null ? 'The coach infers this correction budget.' : 'You chose this correction budget.'} Change it in Edit choices.</p><p className="lesson-meta">Choices apply to the next reply and are shared across conversations in this language pair.</p></details>
    <details className="lesson-section"><summary>Your preferences &amp; memory corrections{lesson.choices.preferences.length ? ` · ${lesson.choices.preferences.length}` : ''}</summary><Notes label="Explicit choices · override inferred memory" items={lesson.choices.preferences} /><button className="lesson-action" type="button" onClick={() => onAsk('I want to correct what you remember about me: ')}>Correct a memory</button></details>
    <details className="lesson-section"><summary>What the coach has noticed</summary><p className="lesson-meta">Inferred from practice. {observationStatus}</p>
      {plan && <><Notes label="Suggested practice" items={plan.session_focus} /><Notes label="Recurring corrections" items={plan.recurring_errors.map((e) => `${e.error} → ${e.correction} · seen ${e.seen_count} times`)} /><Notes label="Vocabulary to revisit" items={plan.vocab_recycle} /><Notes label="Interests noticed" items={plan.learner_interests} /><Notes label="Overload notes (recorded, not sent as instructions)" items={plan.avoid} /><p>Energy: {plan.energy_read || 'No observation yet'}</p><Notes label="Already covered" items={plan.taught_ledger.map((m) => `${m.mechanic} · turn ${m.last_seen_turn}`)} /></>}
    </details>
    <details className="lesson-section"><summary>Learner memory</summary><p className="lesson-meta">Inferred across conversations for this language pair. Correct assumptions through the coach or Edit choices.</p>
      {profile && <><p>{profile.about || 'No learner summary yet.'}</p><p>{profile.level_notes}</p><Notes label="Strengths" items={profile.strengths} /><Notes label="Working on" items={profile.weaknesses} /><Notes label="Interests" items={profile.interests} /><Notes label="Long-term corrections" items={profile.long_term_errors.map((e) => `${e.error} → ${e.correction} · seen ${e.seen_count} times`)} /></>}
    </details>
    <details className="lesson-section"><summary>What changed{lesson.revision > 0 ? ` · revision ${lesson.revision}` : ''}</summary>
      {lesson.changes.length === 0 && <p>No explicit lesson changes yet.</p>}
      {[...lesson.changes].reverse().map((change) => <article className="lesson-change" key={change.revision}><h4>{change.source} · {new Date(change.at_ms).toLocaleString()}</h4><p>{change.reason}</p><details><summary>Before</summary><ChoiceSummary choices={change.before} /></details><strong>After</strong><ChoiceSummary choices={change.after} /></article>)}
      <p className="lesson-meta">The most recent 20 explicit changes are retained. Observer notes are shown separately.</p>
    </details>
    </details>
  </div>
}
