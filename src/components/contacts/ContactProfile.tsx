import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import type { Partner, PartnerDetails } from '../../contracts'
import { ErrorDetails } from '../ErrorDetails'

const VIBES = ['🌿', '☀️', '🌊', '📚', '🎵', '🚲', '🍵', '🌙', '🏔️', '🎨']

export interface ContactProfileHandle { flush: () => Promise<void> }

/** An editor for one saved contact. Saving is owned by the caller; rendering requests no work. */
export function ContactProfile({ contact, language, onSave, ref }: {
  ref?: Ref<ContactProfileHandle>
  contact: Partner
  language: string
  onSave: (contact: Partner, details: PartnerDetails) => Promise<Partner>
}) {
  const [base, setBase] = useState(contact)
  const [draft, setDraft] = useState(contact.details)
  const [saved, setSaved] = useState(contact.details)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const writing = useRef<Promise<void> | null>(null)
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  useEffect(() => {
    if (!dirty && !busy && contact.revision > base.revision) {
      setBase(contact); setDraft(contact.details); setSaved(contact.details)
    }
  }, [contact, base.revision, dirty, busy])
  function save(next = draft): Promise<void> {
    if (writing.current) return writing.current
    if (JSON.stringify(next) === JSON.stringify(saved)) return Promise.resolve()
    if (!next.name.trim()) {
      const reason = new Error('Name is required.')
      setError(reason.message)
      return Promise.reject(reason)
    }
    setBusy(true); setError(null)
    const write = (async () => {
      try { const savedContact = await onSave(base, next); setBase(savedContact); setSaved(next) }
      catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); throw reason }
      finally { writing.current = null; setBusy(false) }
    })()
    writing.current = write
    return write
  }
  // Close paths flush the focused field too: Escape does not cause blur first.
  useImperativeHandle(ref, () => ({ flush: () => save() }))
  const autosave = (next = draft) => { void save(next).catch(() => { /* Failure remains beside the draft. */ }) }
  return <form className="contact-profile" aria-label="Contact profile" onSubmit={event => { event.preventDefault(); autosave() }}>
    <p className="persona-hint">{language} · Changes apply to this contact’s next replies across conversations.</p>
    <fieldset disabled={busy}>
      <label className="persona-field"><span>Name</span><input className="field" required maxLength={80} value={draft.name} onBlur={() => { autosave() }} dir="auto" onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
      <label className="persona-field"><span>Conversational tendencies</span><textarea className="field" rows={3} maxLength={600} value={draft.tendencies} onBlur={() => { autosave() }} dir="auto" onChange={event => setDraft({ ...draft, tendencies: event.target.value })} /></label>
      <details><summary>Background</summary><label className="persona-field"><span>Background</span><textarea className="field" rows={5} maxLength={2000} value={draft.background} onBlur={() => { autosave() }} dir="auto" onChange={event => setDraft({ ...draft, background: event.target.value })} /></label></details>
      <fieldset className="contact-vibe"><legend>Vibe</legend>{VIBES.map(vibe => <button type="button" className="btn" key={vibe} aria-label={`Vibe ${vibe}`} aria-pressed={draft.vibe.includes(vibe)} disabled={!draft.vibe.includes(vibe) && draft.vibe.length >= 8} onClick={() => { const next = { ...draft, vibe: draft.vibe.includes(vibe) ? draft.vibe.filter(value => value !== vibe) : [...draft.vibe, vibe] }; setDraft(next); autosave(next) }}>{vibe}</button>)}</fieldset>

    </fieldset>
    {busy && <p className="persona-hint" role="status">Saving…</p>}
    {error && <ErrorDetails label="Saving profile" errorKey={error}>{error}<button type="button" className="btn" disabled={busy} onClick={() => { autosave() }}>Retry save</button></ErrorDetails>}
  </form>
}
