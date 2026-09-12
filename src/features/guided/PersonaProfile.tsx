import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import type { Persona, PersonaDetails } from '../../contracts'
import { ErrorDetails } from '../../ui/ErrorDetails'
import { PersonaForm } from './PersonaForm'
import { blankPersona, personaObjection } from './personaLimits'

export interface PersonaProfileHandle { flush: () => Promise<void> }

/** An editor for one saved persona. Saving is owned by the caller; rendering requests no work. */
export function PersonaProfile({ persona, language, romanized, onSave, ref }: {
  ref?: Ref<PersonaProfileHandle>
  persona: Persona
  language: string
  /// The persona's language has a romanization system.
  romanized: boolean
  onSave: (persona: Persona, details: PersonaDetails) => Promise<Persona>
}) {
  const [base, setBase] = useState(persona)
  const [draft, setDraft] = useState(persona.details)
  const [saved, setSaved] = useState(persona.details)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The form keeps its list text locally, so a cleared draft remounts it.
  const [revision, setRevision] = useState(0)
  /// Blank every field in the draft. Nothing is written: a cleared persona does not
  /// pass validation until it is filled in again, so it cannot replace the saved one.
  const clear = () => { setDraft(blankPersona(romanized)); setRevision(value => value + 1); setError(null) }
  const writing = useRef<Promise<void> | null>(null)
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  useEffect(() => {
    if (!dirty && !busy && persona.revision > base.revision) {
      setBase(persona); setDraft(persona.details); setSaved(persona.details)
    }
  }, [persona, base.revision, dirty, busy])
  function save(next = draft): Promise<void> {
    if (writing.current) return writing.current
    if (JSON.stringify(next) === JSON.stringify(saved)) return Promise.resolve()
    const reason = personaObjection(next, romanized)
    if (reason) {
      setError(reason)
      return Promise.reject(new Error(reason))
    }
    setBusy(true); setError(null)
    const write = (async () => {
      try { const savedPersona = await onSave(base, next); setBase(savedPersona); setSaved(next) }
      catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); throw reason }
      finally { writing.current = null; setBusy(false) }
    })()
    writing.current = write
    return write
  }
  // Close paths flush the focused field too: Escape does not cause blur first.
  useImperativeHandle(ref, () => ({ flush: () => save() }))
  const autosave = (next = draft) => { void save(next).catch(() => { /* Failure remains beside the draft. */ }) }
  return <form className="persona-profile" aria-label="Persona profile" onSubmit={event => { event.preventDefault(); autosave() }}>
    <p className="persona-hint">{language} · Changes apply to this contact’s next replies across conversations.</p>
    <fieldset disabled={busy}>
      <PersonaForm key={revision} draft={draft} romanized={romanized} onChange={setDraft} onCommit={next => { setDraft(next); autosave(next) }} />
    </fieldset>
    <div className="modal-actions"><button type="button" className="btn" disabled={busy} onClick={clear}>Clear</button></div>
    {busy && <p className="persona-hint" role="status">Saving…</p>}
    {error && <ErrorDetails label="Saving persona" errorKey={error}>{error}<button type="button" className="btn" disabled={busy} onClick={() => { autosave() }}>Retry save</button></ErrorDetails>}
  </form>
}
