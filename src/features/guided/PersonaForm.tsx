import { useState } from 'react'
import type { PersonaDetails } from '../../contracts'
import { PERSONA_LIMITS } from '../../contracts'
import { PERSONA_LISTS, isEmoji, itemsToLines, linesToItems, sameItems } from './personaLimits'

type ListKey = (typeof PERSONA_LISTS)[number]['key']

/// The persona fields, controlled. Saving belongs to the caller: an existing
/// persona autosaves through its editor, and a new one is written only on Create.
export function PersonaForm({ draft, romanized, onChange, onCommit, disabled }: {
  draft: PersonaDetails
  /// The persona's language has a romanization system, so the name is also
  /// written in Latin letters.
  romanized: boolean
  onChange: (next: PersonaDetails) => void
  /// Called on blur with the value as it stands, which is when a caller that
  /// autosaves should write.
  onCommit: (next: PersonaDetails) => void
  disabled?: boolean
}) {
  // List fields keep the text being typed; the draft only ever holds parsed items.
  const [lists, setLists] = useState<Record<ListKey, string>>(() =>
    Object.fromEntries(PERSONA_LISTS.map(({ key }) => [key, itemsToLines(draft[key])])) as Record<ListKey, string>)
  const [vibeDraft, setVibeDraft] = useState('')
  const [vibeError, setVibeError] = useState<string | null>(null)
  const edit = (patch: Partial<PersonaDetails>) => onChange({ ...draft, ...patch })
  const commit = (patch: Partial<PersonaDetails>) => onCommit({ ...draft, ...patch })
  const commitList = (key: ListKey, value: string) => {
    const items = linesToItems(value)
    setLists(current => ({ ...current, [key]: itemsToLines(items) }))
    if (sameItems(items, draft[key])) return
    onChange({ ...draft, [key]: items })
    onCommit({ ...draft, [key]: items })
  }
  const addVibe = () => {
    const value = vibeDraft.trim()
    if (!value) return
    if (!isEmoji(value)) { setVibeError('Each Vibe entry must be one emoji. ' + value + ' is not an emoji.'); return }
    if (draft.vibe.includes(value)) { setVibeError('Vibe symbols must be distinct.'); return }
    if (draft.vibe.length >= PERSONA_LIMITS.vibeMax) { setVibeError('Vibe needs between ' + PERSONA_LIMITS.vibeMin + ' and ' + PERSONA_LIMITS.vibeMax + ' emoji.'); return }
    const next = { ...draft, vibe: [...draft.vibe, value] }
    setVibeDraft(''); setVibeError(null); onChange(next); onCommit(next)
  }
  const removeVibe = (symbol: string) => {
    if (draft.vibe.length <= PERSONA_LIMITS.vibeMin) { setVibeError('Vibe needs between ' + PERSONA_LIMITS.vibeMin + ' and ' + PERSONA_LIMITS.vibeMax + ' emoji.'); return }
    const next = { ...draft, vibe: draft.vibe.filter(value => value !== symbol) }
    setVibeError(null); onChange(next); onCommit(next)
  }
  return <>
    <fieldset className="persona-group persona-identity"><legend>Identity</legend>
      <label className="persona-field"><span>Name</span><input className="field" required maxLength={PERSONA_LIMITS.nameMax} value={draft.name} disabled={disabled} dir="auto"
        onChange={event => edit({ name: event.target.value })} onBlur={() => commit({})} /></label>
      {romanized && <label className="persona-field"><span>Romanized name <em className="persona-field-hint">In Latin letters</em></span><input className="field" required maxLength={PERSONA_LIMITS.nameMax} value={draft.romanizedName ?? ''} disabled={disabled}
        onChange={event => edit({ romanizedName: event.target.value })} onBlur={() => commit({})} /></label>}
      <label className="persona-field"><span>Age</span><input className="field" type="number" min={PERSONA_LIMITS.ageMin} max={PERSONA_LIMITS.ageMax} value={draft.age ?? ''} disabled={disabled}
        onChange={event => edit({ age: event.target.value === '' ? null : Number(event.target.value) })} onBlur={() => commit({})} /></label>
      <label className="persona-field"><span>Lives in</span><input className="field" maxLength={PERSONA_LIMITS.locationMax} value={draft.location} disabled={disabled} dir="auto"
        onChange={event => edit({ location: event.target.value })} onBlur={() => commit({})} /></label>
      <label className="persona-field persona-wide"><span>Occupation</span><input className="field" maxLength={PERSONA_LIMITS.occupationMax} value={draft.occupation} disabled={disabled} dir="auto"
        onChange={event => edit({ occupation: event.target.value })} onBlur={() => commit({})} /></label>
    </fieldset>
    <fieldset className="persona-group"><legend>Background</legend>
      <label className="persona-field"><span>Background</span><textarea className="field" rows={3} maxLength={PERSONA_LIMITS.backgroundMax} value={draft.background} disabled={disabled} dir="auto"
        onChange={event => edit({ background: event.target.value })} onBlur={() => commit({})} /></label>
    </fieldset>
    <fieldset className="persona-group"><legend>Life right now</legend>
      <label className="persona-field"><span>Current situation</span><textarea className="field" rows={2} maxLength={PERSONA_LIMITS.currentSituationMax} value={draft.currentSituation} disabled={disabled} dir="auto"
        onChange={event => edit({ currentSituation: event.target.value })} onBlur={() => commit({})} /></label>
    </fieldset>
    <fieldset className="persona-group"><legend>Interests, opinions and favorites</legend>
      {PERSONA_LISTS.map(({ key, label, hint }) => <label className="persona-field" key={key}>
        <span>{label} <em className="persona-field-hint">{hint}</em></span>
        <textarea className="field" rows={2} aria-label={label} value={lists[key]} disabled={disabled} dir="auto"
          onChange={event => setLists(current => ({ ...current, [key]: event.target.value }))}
          onBlur={event => commitList(key, event.target.value)} />
      </label>)}
    </fieldset>
    <fieldset className="persona-group"><legend>Style</legend>
      <label className="persona-field"><span>Manner</span><textarea className="field" rows={2} maxLength={PERSONA_LIMITS.mannerMax} value={draft.manner} disabled={disabled} dir="auto"
        onChange={event => edit({ manner: event.target.value })} onBlur={() => commit({})} /></label>
    </fieldset>
    <fieldset className="persona-group"><legend>Vibe</legend>
      {draft.vibe.length > 0 && <div className="persona-vibe-chips">{draft.vibe.map(symbol => <span className="persona-vibe-chip" key={symbol}>{symbol}<button type="button" aria-label={'Remove ' + symbol} disabled={disabled} onClick={() => removeVibe(symbol)}>✕</button></span>)}</div>}
      <label className="persona-field"><span>Add emoji <em className="persona-field-hint">{'Any emoji, ' + PERSONA_LIMITS.vibeMin + '–' + PERSONA_LIMITS.vibeMax}</em></span>
        <input className="field" value={vibeDraft} disabled={disabled} dir="auto" aria-label="Add a Vibe emoji"
          onChange={event => { setVibeDraft(event.target.value); setVibeError(null) }}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addVibe() } }}
          onBlur={() => { if (vibeDraft.trim()) addVibe() }} />
      </label>
      {vibeError && <p className="persona-inline-error" role="alert">{vibeError}</p>}
    </fieldset>
  </>
}
