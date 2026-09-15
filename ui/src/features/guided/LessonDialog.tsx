import { useEffect, useRef, useState } from 'react'
import type { ConversationSnapshot, LessonControl, LessonCategory } from '../../generated/contracts'
import { executeAction, nativeError } from '../../platform/ipc/workspace'
import { DetailDialog } from '../../components/DetailDialog'
import { useI18n } from '../../components/i18n'
import { useNavigationStore } from '../../state/navigation'
import { useReadingPreferences } from '../../components/ReadingPreferences'
import { TargetText } from '../../components/TargetText'
import { playRewardSound, unlockRewardAudio } from '../../platform/audio/reward-sounds'
import { Markdown } from '../../components/Markdown'

export function LessonDialog({ snapshot, busy, beforeAction, onClose, onPractice, embedded = false, onLessonSelected }: {
  onLessonSelected?: (id: string) => void
  embedded?: boolean
  snapshot: ConversationSnapshot; busy: boolean; beforeAction: () => Promise<void>; onClose: () => void; onPractice?: () => void
}) {
  const tr = useI18n()
  const reading = useReadingPreferences()
  const [step, setStep] = useState(0)
  const [furthestStep, setFurthestStep] = useState(0)
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [category, setCategory] = useState<LessonCategory>('practical')
  const [topic, setTopic] = useState('')
  const [question, setQuestion] = useState('')
  const questionRevision = useRef(0)
  const questionOwner = useRef('')
  questionOwner.current = `${snapshot.conversationId}:${selected}`
  const updateQuestion = (value: string) => { questionRevision.current++; setQuestion(value) }
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState<string[]>([])
  const lock = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const lessons = snapshot.lessons ?? []
  const lesson = lessons.find(item => item.id === selected)
  const active = lessons.find(item => item.status === 'practicing')
  const pendingTurn = snapshot.turns.some(turn => turn.state === 'pending')
  const disabled = pending || busy || pendingTurn
  async function run(action: () => Promise<void>) {
    if (lock.current) return
    lock.current = true; setPending(true); setError(null)
    try { await action() } catch (failure) { if (mounted.current) setError(nativeError(failure)) }
    finally { lock.current = false; if (mounted.current) setPending(false) }
  }
  async function generate(value: string, choiceId: string | null = null, requestedCategory = category) {
    await run(async () => {
      await beforeAction()
      if (!mounted.current) return
      const receipt = await executeAction(snapshot, { kind: 'generateLesson', category: requestedCategory, choiceId, conversationId: snapshot.conversationId, topic: value, expectedRevision: snapshot.revision })
      if (mounted.current) { setSelected(receipt.entityId); onLessonSelected?.(receipt.entityId); updateQuestion(''); setStep(0); setFurthestStep(0); setCreating(false) }
    })
  }
  async function control(id: string, control: LessonControl) {
    await run(async () => {
      if (control === 'practice') await beforeAction()
      await executeAction(snapshot, { kind: 'controlLesson', conversationId: snapshot.conversationId, lessonId: id, control, expectedRevision: snapshot.revision })
      if (control === 'practice' && mounted.current) { onPractice?.(); onClose() }
    })
  }
  async function select(id: string) {
    setSelected(id); onLessonSelected?.(id); updateQuestion(''); setError(null); setStep(0); setFurthestStep(0)
    const item = lessons.find(item => item.id === id)
    if (item?.plan) await control(id, 'open')
  }
  // Generated content is revealed only once exposure has been saved. Reopening
  // cannot award credit or regenerate a lesson. Concurrent changes show an error.
  const needsExposure = lesson?.plan && !lesson.exposed
  useEffect(() => {
    if (needsExposure && !lock.current && !error && lesson) void control(lesson.id, 'open')
  }, [lesson?.id, needsExposure, snapshot.revision, error])
  const plan = lesson?.exposed ? lesson.plan : null
  const coachMessages = snapshot.coachMessages.filter(message => lesson?.coachTurnIds.includes(message.turnId))
  const coachTurns = snapshot.turns.filter(turn => lesson?.coachTurnIds.includes(turn.id))
  const coachError = coachTurns.flatMap(turn => turn.attempts).filter(attempt => attempt.error).at(-1)?.error
  const content = <>
    <div className={`explicit-lesson ${embedded ? 'embedded-lesson' : ''}`}>
      <aside className="lesson-rail">
      <div className="pane-header"><span>{tr('Learn')}</span><button type="button" aria-label={tr('Lesson type')} disabled={pending} aria-expanded={creating} onClick={() => setCreating(value => !value)}>+</button></div>
      <div className="lesson-create" hidden={!creating && !!selected}>
        <fieldset className="lesson-categories"><legend>{tr('Lesson type')}</legend>
          {(['practical', 'grammar', 'aboutLanguage', 'reading'] as const).map(value => <label key={value}><input type="radio" name="lesson-category" value={value} checked={category === value} disabled={pending} onChange={() => setCategory(value)} />{tr(value === 'practical' ? 'Practical situations' : value === 'grammar' ? 'Grammar' : value === 'reading' ? 'Reading' : 'About the language')}</label>)}
        </fieldset>
        <div className="lesson-choice-list">
          {category !== 'practical' && (category === 'reading' ? ['Letters and sounds', 'Reading words', 'Pronunciation and stress'] : category === 'grammar' ? ['Past tense', 'Asking questions', 'Word order'] : ['History and language family', 'Alphabet and writing system', 'Sounds and spelling']).map(value => <button key={value} type="button" disabled={disabled} onClick={() => void generate(tr(value))}>{tr(value)}</button>)}
          {category === 'practical' && (snapshot.lessonChoices ?? []).slice(0, 3).map(choice => <button key={choice.id} type="button" aria-label={choice.label} disabled={disabled} onClick={() => void generate(choice.label, choice.id)}>
            <strong dir="auto">{choice.label}</strong><small dir="auto">{choice.reason}</small>
          </button>)}
        </div>
        <form className="lesson-topic-form" onSubmit={event => { event.preventDefault(); void generate(topic.trim()) }}>
          <label htmlFor="lesson-topic">{tr('Request a topic')}</label>
          <input id="lesson-topic" value={topic} maxLength={500} onChange={event => setTopic(event.target.value)} disabled={pending} />
          <button type="submit" disabled={disabled || !topic.trim()}>{tr('Create lesson')}</button>
        </form>
      </div>
        {lessons.length > 0 && <section aria-label={tr('Saved lessons')}>
          <h3>{tr('Saved lessons')}</h3>
          <div className="lesson-choice-list">{lessons.map(item => <button key={item.id} type="button" disabled={pending} onClick={() => void select(item.id)}>
            <span dir="auto">{item.plan?.title ?? item.topic}</span>
            {item.status === 'practicing' && <small>{tr('Practising in chat')}</small>}
            {item.status === 'completed' && <small>{tr('Task completed')}</small>}
          </button>)}</div>
        </section>}
      </aside>
      <section className="lesson-main">
      <div className="pane-header">{tr('Take a lesson')}</div>
      {!selected ? <p>{tr('Request a topic')}</p> : <>
        {embedded && <nav className="lesson-steps" aria-label={tr('Learn')}>
          {['Objective', 'Examples', 'Exercise', 'Quiz', 'Practice'].map((label, index) => <button type="button" key={label} aria-label={tr(label)} disabled={index > furthestStep} aria-current={step === index ? 'step' : undefined} onClick={() => setStep(index)}><span aria-hidden="true">{index < furthestStep ? '✓' : index + 1}</span>{tr(label)}</button>)}
        </nav>}
        {!lesson && <p role="status">{tr('Loading lesson…')}</p>}
        {lesson?.status === 'generating' && <p role="status">{tr('Creating lesson…')}</p>}
        {lesson && !lesson.plan && lesson.status !== 'generating' && <>
          <p role="alert">{lesson.error ?? tr('Lesson generation did not finish.')}</p>
          <button type="button" disabled={disabled} onClick={() => void generate(lesson.topic, null, lesson.category)}>{tr('Retry lesson')}</button>
        </>}
        {needsExposure && error && <button type="button" onClick={() => lesson && void control(lesson.id, 'open')}>{tr('Open lesson')}</button>}
        {plan && lesson && <>
          <h3 dir="auto">{plan.title}</h3>
          {lesson.error && <><p role="alert">{lesson.error}</p><button type="button" onClick={() => { onClose(); useNavigationStore.getState().showOverlay('activity') }}>{tr('Open AI activity')}</button></>}
          <div hidden={embedded && step !== 0}><p className="lesson-objective" dir="auto">{plan.objective}</p>
          <p dir="auto">{plan.explanation}</p>
          </div>
          <div hidden={embedded && step !== 1} className="lesson-examples">{plan.examples.map((example, index) => <div key={index}>
            <TargetText text={example.text} />{reading.alwaysRomanize && example.romanization && <p dir="auto">{example.romanization}</p>}{reading.alwaysPronunciation && example.pronunciation && <p dir="auto">{example.pronunciation}</p>}<p dir="auto">{example.translation}</p>
          </div>)}</div>
          <div hidden={embedded && step !== 2}>
            <h4>{tr('Practise with the coach')}</h4>
            <p dir="auto">{plan.exercise}</p>
          <form className="lesson-question-form" onSubmit={event => {
            event.preventDefault()
            const revision = questionRevision.current
            const owner = questionOwner.current
            void run(async () => {
              await executeAction(snapshot, { kind: 'askLessonCoach', conversationId: snapshot.conversationId, lessonId: lesson.id, text: question.trim(), expectedRevision: snapshot.revision })
              if (mounted.current && questionRevision.current === revision && questionOwner.current === owner) updateQuestion('')
            })
          }}>
            <label htmlFor="lesson-question">{tr('Ask the coach or try the exercise')}</label>
            <textarea id="lesson-question" rows={2} value={question} maxLength={20000} onChange={event => updateQuestion(event.target.value)} />
            <button type="submit" disabled={disabled || !question.trim()}>{tr('Ask the coach')}</button>
          </form>
          {coachMessages.length > 0 && <div className="lesson-coach-messages" aria-live="polite">{coachMessages.map(message => <div key={message.id} className={`coach-msg ${message.role === 'user' ? 'user' : 'coach'}`}><Markdown text={message.text} /></div>)}</div>}
          {coachTurns.some(turn => turn.state === 'pending') && <p role="status">{tr('Coach replying…')}</p>}
          {coachError && <p role="alert">{coachError}</p>}
          </div>
          <section hidden={embedded && step !== 3} className="lesson-quiz" aria-label={tr('Test your understanding')}>
            <h3>{tr('Test your understanding')}</h3>
            {plan.quiz.map((quiz, questionIndex) => {
              const answer = lesson.quizAnswers.find(item => item.questionIndex === questionIndex)
              return <fieldset key={questionIndex} disabled={pending || !!answer || submitted.includes(`${lesson.id}:${questionIndex}`)}>
                <legend dir="auto">{quiz.question}</legend>
                <div className="lesson-choice-list">{quiz.options.map((option, optionIndex) => <button key={optionIndex} type="button" aria-pressed={answer?.optionIndex === optionIndex} onClick={event => {
                  const target = event.currentTarget
                  unlockRewardAudio()
                  void run(async () => {
                    await executeAction(snapshot, { kind: 'answerLessonQuiz', conversationId: snapshot.conversationId, lessonId: lesson.id, questionIndex, optionIndex })
                    if (mounted.current) setSubmitted(previous => [...previous, `${lesson.id}:${questionIndex}`])
                    if (mounted.current && optionIndex === quiz.correctOption) playRewardSound({ kind: 'xp', xp: 1 }, target)
                  })
                }} dir="auto">{option}</button>)}</div>
                {answer && <div role="status"><strong>{answer.correct ? tr('Correct · +1 XP') : tr('0 XP')}</strong>{!answer.correct && <p dir="auto">{tr('Correct answer: ')}{quiz.options[quiz.correctOption]}</p>}<p dir="auto">{quiz.explanation}</p></div>}
              </fieldset>
            })}
          </section>
          <div hidden={embedded && step !== 4}>
          {lesson.status === 'ready' && <>
            {active && <p>{tr('Starting this lesson ends the current practice task.')}</p>}
            <button type="button" disabled={disabled} onClick={() => void control(lesson.id, 'practice')}>{tr('Try it in chat')}</button>
          </>}
          {lesson.status === 'practicing' && <div className="lesson-practice-actions">
            <button type="button" onClick={() => { onPractice?.(); onClose() }}>{tr('Continue chatting')}</button>
            <button type="button" disabled={pending} onClick={() => void control(lesson.id, 'end')}>{tr('End practice')}</button>
          </div>}
          {lesson.recap && <section aria-label={tr('Lesson recap')}><h3>{tr('Lesson recap')}</h3><p dir="auto">{lesson.recap.text}</p>{lesson.recap.evidence.map((e, index) => <blockquote key={index}><TargetText text={e.quote} /></blockquote>)}</section>}
          </div>
          {embedded && step < 4 && <button type="button" className="lesson-next" onClick={() => { setStep(step + 1); setFurthestStep(Math.max(furthestStep, step + 1)) }}>{tr('Next step')}</button>}
        </>}
      </>}
      {error && <p role="alert">{error}</p>}
      </section>
    </div>
  </>
  return embedded ? content : <DetailDialog title={tr('Take a lesson')} onClose={onClose}>{content}</DetailDialog>
}
