import { useState } from 'react'
import type { PersonaDetails } from '../../contracts'
import { PERSONA_LIMITS } from '../../contracts'
import { DetailDialog } from '../../ui/DetailDialog'
import { ErrorDetails } from '../../ui/ErrorDetails'
import { ActivityIndicator } from '../../ui/ActivityIndicator'
import { generatePersona, nativeError } from '../../platform/ipc/workspace'
import { PersonaForm } from './PersonaForm'
import { blankPersona, personaObjection } from './personaLimits'

/// Three ways to a new persona — write it, describe it, or ask for one — and one
/// review step. Generating only fills the form: nothing is written until Create.
export function NewPersonaDialog({ language, romanized, busy, onCreate, onClose }: {
  language: string
  /// The language has a romanization system, so the name is also given in Latin letters.
  romanized: boolean
  busy: boolean
  onCreate: (details: PersonaDetails) => Promise<void>
  onClose: () => void
}) {
  const [draft, setDraft] = useState<PersonaDetails>(() => blankPersona(romanized))
  // The form keeps its list text locally, so a generated or cleared draft remounts it.
  const [revision, setRevision] = useState(0)
  const [brief, setBrief] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const objection = personaObjection(draft, romanized)
  const locked = busy || generating
  const replace = (next: PersonaDetails) => { setDraft(next); setRevision(value => value + 1) }
  const generate = async (text: string) => {
    if (locked) return
    setGenerating(true); setGenerationError(null)
    try { replace(await generatePersona(language, text)) }
    catch (reason) { setGenerationError(nativeError(reason)) }
    finally { setGenerating(false) }
  }
  const clear = () => { replace(blankPersona(romanized)); setBrief(''); setGenerationError(null) }
  return <DetailDialog title="New persona" onClose={onClose}>
    <h2>New persona</h2>
    <div className="persona-generate">
      <textarea className="field" rows={3} aria-label="Describe them" maxLength={PERSONA_LIMITS.briefMax} value={brief} disabled={locked} dir="auto"
        placeholder="Describe them (optional), e.g. retired fisherman who distrusts tourists"
        onChange={event => setBrief(event.target.value)} />
      <div className="persona-generate-actions">
        <button type="button" className="btn" disabled={locked || !brief.trim()} onClick={() => void generate(brief)}>Generate</button>
        <button type="button" className="btn" disabled={locked} onClick={() => void generate('')}>Surprise me</button>
        {generating && <ActivityIndicator compact label="Generating a persona…" />}
      </div>
    </div>
    {generationError && <ErrorDetails label="Generating a persona" errorKey={generationError}>{generationError}</ErrorDetails>}
    <form className="persona-profile" aria-label="New persona" onSubmit={event => { event.preventDefault(); if (!objection && !locked) void onCreate(draft) }}>
      <fieldset disabled={locked}>
        <PersonaForm key={revision} draft={draft} romanized={romanized} onChange={setDraft} onCommit={setDraft} />
      </fieldset>
      {objection && <p className="persona-hint" role="status">{objection}</p>}
      <div className="modal-actions">
        <button type="button" className="btn" disabled={locked} onClick={clear}>Clear</button>
        <button type="button" className="btn" disabled={busy} onClick={onClose}>Cancel</button>
        <button type="submit" className="btn primary" disabled={locked || Boolean(objection)}>{busy ? 'Creating…' : 'Create'}</button>
      </div>
    </form>
  </DetailDialog>
}
