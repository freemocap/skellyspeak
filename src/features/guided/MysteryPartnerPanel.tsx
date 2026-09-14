import { useEffect, useRef, useState } from 'react'
import type { ConversationSnapshot, MysteryField, Persona } from '../../contracts'
import { useSkillEvidenceStore } from '../../state/skill-evidence'
import { executeAction, nativeError } from '../../platform/ipc/workspace'
import { DetailDialog } from '../../ui/DetailDialog'
import { useI18n } from '../../ui/i18n'
import { playRewardSound, unlockRewardAudio } from '../../platform/audio/reward-sounds'

const labels: Record<MysteryField, string> = { occupation: 'Occupation', manner: 'Manner', location: 'Lives in', age: 'Age', interests: 'Interests' }
const alternatives: Record<MysteryField, string[]> = {
  occupation: ['Teacher', 'Engineer', 'Cook'], manner: ['Warm', 'Curious', 'Formal'],
  location: ['Madrid', 'Paris', 'Berlin'], age: ['24', '42', '67'], interests: ['Music', 'Cooking', 'Reading'],
}
function answer(persona: Persona, field: MysteryField): string {
  const value = persona.details[field]
  return Array.isArray(value) ? value.join(' · ') : String(value ?? '')
}
export function MysteryPartnerPanel({ snapshot, persona, otherPersonas = [] }: { snapshot: ConversationSnapshot; persona: Persona; otherPersonas?: Persona[] }) {
  const tr = useI18n()
  const mystery = snapshot.mystery
  const [quiz, setQuiz] = useState<{ field: MysteryField; options: string[]; revision: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [incorrect, setIncorrect] = useState(false)
  const [celebration, setCelebration] = useState<{ field: MysteryField; phase: 'guess' | 'reveal' } | null>(null)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  // The parent keys this component by partner, so pending results never enter another game.
  const pendingField = mystery?.fields.find(field => field.state === 'hidden')
  if (!mystery) return null
  function open(field = pendingField?.field) {
    if (!field) return
    const real = answer(persona, field)
    const values = [...new Set([real, ...otherPersonas.filter(other => other.id !== persona.id && other.languageId === persona.languageId).map(other => answer(other, field)).filter(Boolean), ...alternatives[field].map(value => field === 'age' ? value : tr(value))])].slice(0, 4)
    // Stable placement avoids moving options while a snapshot refreshes.
    const shift = [...persona.id + field].reduce((sum, character) => sum + character.charCodeAt(0), 0) % values.length
    setQuiz({ field, options: [...values.slice(shift), ...values.slice(0, shift)], revision: persona.revision }); setIncorrect(false); setError(null)
  }
  async function run(action: Parameters<typeof executeAction>[1], target?: HTMLElement) {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(null)
    try {
      const receipt = await executeAction(snapshot, action)
      if (!mounted.current) return
      if (action.kind === 'guessMystery') {
        useSkillEvidenceStore.getState().reload()
        if (receipt.entityId === 'incorrect') { setIncorrect(true); return }
        if (receipt.entityId === 'correct') {
          setCelebration({ field: action.field, phase: 'guess' })
          if (target) playRewardSound({ kind: 'xp', xp: 1 }, target)
        }
        setQuiz(null)
      } else if (action.kind === 'revealMystery') setCelebration({ field: action.field, phase: 'reveal' })
    } catch (reason) { if (mounted.current) setError(nativeError(reason)) }
    finally { lock.current = false; if (mounted.current) setBusy(false) }
  }
  return <section className="mystery-panel" aria-label={tr('Mystery partner')}>
    {celebration?.phase === 'guess' && <p className="mystery-result" role="status">{tr('Guessed correctly · +1 XP')}</p>}
    {mystery.fields.map(item => <div key={item.field} className="mystery-field" data-celebration={celebration?.field === item.field ? celebration.phase : undefined}>
      <strong>{tr(labels[item.field])}</strong>
      {item.state === 'revealed' ? <span dir="auto">{item.value} · {tr('Revealed')}</span> : item.state === 'guessed_unrevealed' ? <><span>{tr('Guessed correctly · +1 XP')}</span><button type="button" disabled={busy} onClick={() => void run({ kind: 'revealMystery', conversationId: snapshot.conversationId, field: item.field })}>{tr('Reveal')}</button></> : <button type="button" disabled={busy} aria-label={tr('Guess {field}', { field: tr(labels[item.field]) })} onClick={() => open(item.field)}>?</button>}
    </div>)}
    {pendingField && !mystery.nudgeDismissed && snapshot.messages.filter(message => message.role === 'user').length >= 8 && <div className="mystery-nudge"><button type="button" onClick={() => open()}>{tr('I think I know them')}</button><button type="button" disabled={busy} aria-label={tr('Dismiss')} onClick={() => void run({ kind: 'dismissMysteryNudge', conversationId: snapshot.conversationId })}>×</button></div>}
    {pendingField && <button type="button" disabled={busy} onClick={() => open()}>{tr('I think I know them')}</button>}
    {error && !quiz && <p role="alert">{error}</p>}
    {quiz && <DetailDialog title={tr('Guess {field}', { field: tr(labels[quiz.field]) })} onClose={() => { if (!busy) setQuiz(null) }}>
      <h2>{tr('Guess {field}', { field: tr(labels[quiz.field]) })}</h2>
      <div className="mystery-options">{quiz.options.map(value => <button type="button" key={value} disabled={busy} dir="auto" onClick={event => { unlockRewardAudio(); void run({ kind: 'guessMystery', conversationId: snapshot.conversationId, field: quiz.field, value, expectedPersonaRevision: quiz.revision }, event.currentTarget) }}>{value}</button>)}</div>
      {incorrect && <p role="status">{tr('Not correct. Try again when you are ready.')}</p>}
      {error && <p role="alert">{error}</p>}
    </DetailDialog>}
  </section>
}
