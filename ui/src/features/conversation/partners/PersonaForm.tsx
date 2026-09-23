import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import { useI18n } from '../../../components/localization/i18n'
import { useImperativeHandle, useState, type Ref } from 'react'
import type { PersonaDetails } from '../../../generated/contracts'
import { PERSONA_LIMITS } from '../../../generated/contracts'
import { PERSONA_LISTS, isEmoji, itemsToLines, linesToItems } from './personaLimits'

export interface PersonaFormHandle { flush: () => PersonaDetails }

type ListKey = (typeof PERSONA_LISTS)[number]['key']

/// The persona fields, controlled. Saving belongs to the caller: an existing
/// persona autosaves through its editor, and a new one is written only on Create.
export function PersonaForm({ draft, romanized, onChange, onCommit, disabled, ref }: {
  ref?: Ref<PersonaFormHandle>
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
  const tr = useI18n()
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
    onChange({ ...draft, [key]: items })
    onCommit({ ...draft, [key]: items })
  }
  const flush = (): PersonaDetails => {
    const next = { ...draft }
    for (const { key } of PERSONA_LISTS) next[key] = linesToItems(lists[key])
    const value = vibeDraft.trim()
    if (value) {
      const reason = !isEmoji(value) ? tr('Each Vibe entry must be one emoji. {symbol} is not an emoji.', { symbol: value })
        : next.vibe.includes(value) ? tr('Vibe symbols must be distinct.')
          : next.vibe.length >= PERSONA_LIMITS.vibeMax ? tr('Vibe needs between {min} and {max} emoji.', { min: PERSONA_LIMITS.vibeMin, max: PERSONA_LIMITS.vibeMax }) : null
      if (reason) { setVibeError(reason); throw new Error(reason) }
      next.vibe = [...next.vibe, value]
      setVibeDraft(''); setVibeError(null)
    }
    onChange(next)
    return next
  }
  // Escape/native cancel do not blur inputs. The parent must collect every local
  // buffer before saving, including an emoji still being composed in Add emoji.
  useImperativeHandle(ref, () => ({ flush }))
  const addVibe = () => {
    if (!vibeDraft.trim()) return
    let next: PersonaDetails
    try { next = flush() }
    catch { return /* Invalid pending input remains visible beside the Vibe field. */ }
    onCommit(next)
  }
  const removeVibe = (symbol: string) => {
    if (draft.vibe.length <= PERSONA_LIMITS.vibeMin) { setVibeError(tr('Vibe needs between {min} and {max} emoji.', { min: PERSONA_LIMITS.vibeMin, max: PERSONA_LIMITS.vibeMax })); return }
    const next = { ...draft, vibe: draft.vibe.filter(value => value !== symbol) }
    setVibeError(null); onChange(next); onCommit(next)
  }
  const traits = ['Warm', 'Curious', 'Blunt', 'Playful', 'Formal']
  const mannerParts = draft.manner.split(';').map(value => value.trim()).filter(Boolean)
  return <div className="persona-form">
    <fieldset className="persona-group persona-identity"><legend>{tr("Identity")}</legend>
      <label className="persona-field"><span>{tr("Name")}</span><input className="field" required maxLength={PERSONA_LIMITS.nameMax} value={draft.name} disabled={disabled} dir="auto"
        onChange={event => edit({ name: event.target.value })} onBlur={() => commit({})} /></label>
      {romanized && <label className="persona-field"><span>{tr("Romanized name ")}<em className="persona-field-hint">{tr("In Latin letters")}</em></span><input className="field" required maxLength={PERSONA_LIMITS.nameMax} value={draft.romanizedName ?? ''} disabled={disabled}
        onChange={event => edit({ romanizedName: event.target.value })} onBlur={() => commit({})} /></label>}
      <label className="persona-field"><span>{tr("Age")}</span><input className="field" type="number" min={PERSONA_LIMITS.ageMin} max={PERSONA_LIMITS.ageMax} value={draft.age ?? ''} disabled={disabled}
        onChange={event => edit({ age: event.target.value === '' ? null : Number(event.target.value) })} onBlur={() => commit({})} /></label>
      <label className="persona-field"><span>{tr("Lives in")}</span><input className="field" maxLength={PERSONA_LIMITS.locationMax} value={draft.location} disabled={disabled} dir="auto"
        onChange={event => edit({ location: event.target.value })} onBlur={() => commit({})} /></label>
      <label className="persona-field persona-wide"><span>{tr("Occupation")}</span><input className="field" maxLength={PERSONA_LIMITS.occupationMax} value={draft.occupation} disabled={disabled} dir="auto"
        onChange={event => edit({ occupation: event.target.value })} onBlur={() => commit({})} /></label>
    </fieldset>
    <fieldset className="persona-group"><legend>{tr("Background")}</legend>
      <label className="persona-field"><span>{tr("Background")}</span><textarea className="field" rows={3} maxLength={PERSONA_LIMITS.backgroundMax} value={draft.background} disabled={disabled} dir="auto"
        onChange={event => edit({ background: event.target.value })} onBlur={() => commit({})} /></label>
    </fieldset>
    <fieldset className="persona-group"><legend>{tr("Life right now")}</legend>
      <label className="persona-field"><span>{tr("Current situation")}</span><textarea className="field" rows={2} maxLength={PERSONA_LIMITS.currentSituationMax} value={draft.currentSituation} disabled={disabled} dir="auto"
        onChange={event => edit({ currentSituation: event.target.value })} onBlur={() => commit({})} /></label>
    </fieldset>
    <fieldset className="persona-group"><legend>{tr("Interests, opinions and favorites")}</legend>
      {PERSONA_LISTS.map(({ key, label, hint, max }) => <label className="persona-field" key={key}>
        <span>{tr(label)} <em className="persona-field-hint">{tr(hint, { max })}</em></span>
        <textarea className="field" rows={2} aria-label={tr(label)} value={lists[key]} disabled={disabled} dir="auto"
          onChange={event => {
            const value = event.target.value
            setLists(current => ({ ...current, [key]: value }))
            edit({ [key]: linesToItems(value) })
          }}
          onBlur={event => commitList(key, event.target.value)} />
      </label>)}
    </fieldset>
    <fieldset className="persona-group"><legend>{tr("Style")}</legend>
      <div className="personality-chips">{traits.map(trait => <button type="button" key={trait} disabled={disabled || (!mannerParts.includes(trait) && draft.manner.length + trait.length + 2 > PERSONA_LIMITS.mannerMax)} aria-pressed={mannerParts.includes(trait)} onClick={() => {
        const manner = mannerParts.includes(trait) ? mannerParts.filter(value => value !== trait).join('; ') : [draft.manner, trait].filter(Boolean).join('; ')
        const next = { ...draft, manner }; onChange(next); onCommit(next)
      }}>{tr(trait)}</button>)}</div>
      <label className="persona-field"><span>{tr("Manner")}</span><textarea className="field" rows={2} maxLength={PERSONA_LIMITS.mannerMax} value={draft.manner} disabled={disabled} dir="auto"
        onChange={event => edit({ manner: event.target.value })} onBlur={() => commit({})} /></label>
    </fieldset>
    <fieldset className="persona-group"><legend>{tr("Vibe")}</legend>
      {draft.vibe.length > 0 && <div className="persona-vibe-chips">{draft.vibe.map(symbol => <span className="persona-vibe-chip" key={symbol}>{symbol}<button type="button" aria-label={tr('Remove {symbol}', { symbol })} disabled={disabled} onClick={() => removeVibe(symbol)}>✕</button></span>)}</div>}
      <label className="persona-field"><span>{tr("Add emoji ")}<em className="persona-field-hint">{tr('Any emoji, {min}–{max}', { min: PERSONA_LIMITS.vibeMin, max: PERSONA_LIMITS.vibeMax })}</em></span>
        <input className="field" value={vibeDraft} disabled={disabled} dir="auto" aria-label={tr("Add a Vibe emoji")}
          onChange={event => { setVibeDraft(event.target.value); setVibeError(null) }}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addVibe() } }}
          onBlur={() => { if (vibeDraft.trim()) addVibe() }} />
      </label>
      {vibeError && <ErrorNotice as="p" error={vibeError} className="persona-inline-error">{vibeError}</ErrorNotice>}
    </fieldset>
  </div>
}
