import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import type { Persona, PersonaDetails } from '../../contracts'
import { ErrorDetails } from '../../ui/ErrorDetails'
import { PersonaForm, type PersonaFormHandle } from './PersonaForm'
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
  const form = useRef<PersonaFormHandle>(null)
  const [base, setBase] = useState(persona)
  // Save/close can run between a write settling and React rendering its result.
  const persisted = useRef(persona)
  const [draft, setDraft] = useState(persona.details)
  const [saved, setSaved] = useState(persona.details)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The form keeps its list text locally, so a cleared draft remounts it.
  const [revision, setRevision] = useState(0)
  /// Blank every field in the draft. Nothing is written: a cleared persona does not
  /// pass validation until it is filled in again, so it cannot replace the saved one.
  const clear = () => { setDraft(blankPersona(romanized)); setRevision(value => value + 1); setError(null) }
  const restore = () => {
    const latest = persona.revision > base.revision ? persona : base
    persisted.current = latest
    setBase(latest); setSaved(latest.details); setDraft(latest.details)
    setRevision(value => value + 1); setError(null)
  }
  const discardButton = useRef<HTMLButtonElement>(null)
  const writing = useRef<Promise<void> | null>(null)
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  useEffect(() => {
    if (!dirty && !busy && persona.revision > base.revision) {
      persisted.current = persona
      setBase(persona); setDraft(persona.details); setSaved(persona.details); setRevision(value => value + 1)
    }
  }, [persona, base.revision, dirty, busy])
  function save(next = draft): Promise<void> {
    if (writing.current) return writing.current
    if (JSON.stringify(next) === JSON.stringify(persisted.current.details)) return Promise.resolve()
    const reason = personaObjection(next, romanized)
    if (reason) {
      setError(reason)
      return Promise.reject(new Error(reason))
    }
    setBusy(true); setError(null)
    const write = (async () => {
      try { const savedPersona = await onSave(persisted.current, next); persisted.current = { ...savedPersona, details: next }; setBase(savedPersona); setSaved(next) }
      catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); throw reason }
      finally { writing.current = null; setBusy(false) }
    })()
    writing.current = write
    return write
  }
  // Close paths flush the focused field too: Escape does not cause blur first.
  useImperativeHandle(ref, () => ({ flush: () => save(form.current?.flush() ?? draft) }))
  const autosave = (next = draft) => { void save(next).catch(() => { /* Failure remains beside the draft. */ }) }
  return <form className="persona-profile" aria-label="Persona profile" onBlurCapture={event => {
    // Moving directly to Discard must not submit the field being abandoned.
    if (event.relatedTarget === discardButton.current) event.stopPropagation()
  }} onSubmit={event => { event.preventDefault(); autosave() }}>
    <p className="persona-hint">{language} · Changes apply to this contact’s next replies across conversations.</p>
    <fieldset disabled={busy}>
      <PersonaForm ref={form} key={revision} draft={draft} romanized={romanized} onChange={setDraft} onCommit={next => { setDraft(next); autosave(next) }} />
    </fieldset>
    <div className="modal-actions">
      <button type="button" className="btn" disabled={busy} onClick={clear}>Clear</button>
      <button ref={discardButton} type="button" className="btn" disabled={busy} onPointerDown={event => event.preventDefault()} onClick={restore}>Discard unsaved changes</button>
    </div>
    {busy && <p className="persona-hint" role="status">Saving…</p>}
    {error && <ErrorDetails label="Saving persona" errorKey={error}>{error}<button type="button" className="btn" disabled={busy} onClick={() => { autosave() }}>Retry save</button></ErrorDetails>}
  </form>
}
