import { useEffect, useMemo, useState } from 'react'
import {
  deletePersona,
  savePersona,
  type Persona,
} from '../lib/tauri'
import { openOverlay } from '../lib/back'
import { reportFault } from '../lib/faults'

/// Matches `personas::MIN_SKETCH` / `MAX_SKETCH` in the core, which enforces
/// them for real — `personas.json` is a file a person can open, so the editor
/// is not the only way in. These exist so the counter can turn red before a
/// save is rejected, not instead of the check.
const MIN_SKETCH = 60
const MAX_SKETCH = 1200

interface PersonaModalProps {
  personas: Persona[]
  /// Which one the picker currently has selected. `surprise` opens the editor
  /// on nothing in particular, since there is no single person to show.
  selectedId: string
  onClose: () => void
  /// Re-read the list from the core after a write.
  onChanged: () => Promise<void>
  /// Select a persona in the picker (and start a conversation with them).
  onUse: (id: string) => void
}

const BLANK = {
  id: '',
  label: '',
  sketch: '',
}

/// The persona control panel.
///
/// Shows who you are talking to and lets you write your own. The template is
/// deliberately opinionated: the whole reason the old partner was boring is
/// that "encouraging and patient" is not a person, so the placeholder asks for
/// a job, a mood and a grievance, and the core refuses a description too short
/// to be any of those.
export function PersonaModal({
  personas,
  selectedId,
  onClose,
  onChanged,
  onUse,
}: PersonaModalProps) {
  // Which row the right-hand pane is showing. Starts on whoever the learner is
  // talking to, so opening this answers "who is this?" without a click.
  const [viewingId, setViewingId] = useState<string>(
    () => personas.find((p) => p.id === selectedId)?.id ?? personas[0]?.id ?? ''
  )
  const [draft, setDraft] = useState(BLANK)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => openOverlay(onClose), [onClose])

  const viewing = useMemo(
    () => personas.find((p) => p.id === viewingId) ?? null,
    [personas, viewingId]
  )

  function show(p: Persona) {
    setViewingId(p.id)
    setEditing(false)
    setError(null)
  }

  function startNew() {
    setDraft(BLANK)
    setEditing(true)
    setError(null)
  }

  /// Built-ins cannot be edited, so the way to "change" one is to fork it. The
  /// copy arrives in the editor unsaved, with a name that says what it is.
  function duplicate(p: Persona) {
    setDraft({ id: '', label: `${p.label} (mine)`, sketch: p.sketch })
    setEditing(true)
    setError(null)
  }

  function edit(p: Persona) {
    setDraft({ id: p.id, label: p.label, sketch: p.sketch })
    setEditing(true)
    setError(null)
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const saved = await savePersona(draft.id, draft.label, draft.sketch)
      await onChanged()
      setViewingId(saved.id)
      setEditing(false)
    } catch (e) {
      // Shown in the editor, next to the field that has to change — a fault
      // bar at the top of the app would tell them it failed without telling
      // them what to fix.
      setError(String(e).replace(/^Error:\s*/, ''))
    } finally {
      setBusy(false)
    }
  }

  async function remove(p: Persona) {
    setBusy(true)
    try {
      await deletePersona(p.id)
      await onChanged()
      setViewingId(personas.find((q) => q.id !== p.id)?.id ?? '')
      setEditing(false)
    } catch (e) {
      reportFault('Deleting a persona', e)
    } finally {
      setBusy(false)
    }
  }

  const count = draft.sketch.trim().length
  const tooShort = count > 0 && count < MIN_SKETCH
  const tooLong = count > MAX_SKETCH

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal persona-modal"
        role="dialog"
        aria-label="Personas"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Personas</h2>
        <p className="sub">
          Who you practise with. The description below is sent to the model as-is on every
          message — that is the whole difference between a conversation and an interview.
        </p>

        <div className="persona-panes">
          <div className="persona-list" role="listbox" aria-label="Personas">
            {personas.map((p) => (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={p.id === viewingId && !editing}
                className={`persona-item ${p.id === viewingId && !editing ? 'on' : ''}`}
                onClick={() => show(p)}
              >
                <span className="persona-item-label">{p.label}</span>
                {!p.builtin && <span className="persona-item-tag">yours</span>}
              </button>
            ))}
            <button type="button" className="persona-item new" onClick={startNew}>
              ✚ Write your own
            </button>
          </div>

          <div className="persona-detail">
            {editing ? (
              <>
                <label className="persona-field">
                  <span>Name</span>
                  <input
                    className="field"
                    value={draft.label}
                    autoFocus
                    placeholder="My uncle Kiko"
                    onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                  />
                </label>
                <label className="persona-field">
                  <span>
                    Who they are
                    <span className={`persona-count ${tooShort || tooLong ? 'bad' : ''}`}>
                      {count}/{MAX_SKETCH}
                    </span>
                  </span>
                  <textarea
                    className="field persona-sketch"
                    rows={9}
                    value={draft.sketch}
                    placeholder={
                      'Write it as "you". Give them a job, a mood, and something that is ' +
                      'annoying them today.\n\n' +
                      'You drive a taxi and are convinced the radio is lying to you. You ' +
                      'argue with the football on television. Your back hurts from a chair ' +
                      'you refuse to replace, and you will tell anyone about it.'
                    }
                    onChange={(e) => setDraft({ ...draft, sketch: e.target.value })}
                  />
                </label>
                <p className="persona-hint">
                  Be specific. Adjectives like “warm” or “curious” are what produced the
                  bland partner this replaces — a job, an opinion and a grievance produce
                  sentences.
                </p>
                {error && (
                  <p className="persona-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="modal-actions">
                  <button type="button" className="btn" onClick={() => setEditing(false)} disabled={busy}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => void save()}
                    disabled={busy}
                  >
                    {busy ? 'Saving…' : 'Save persona'}
                  </button>
                </div>
              </>
            ) : viewing ? (
              <>
                <h3 className="persona-detail-title">
                  {viewing.label}
                  {viewing.builtin && <span className="persona-item-tag">built in</span>}
                </h3>
                <p className="persona-sketch-read">{viewing.sketch}</p>
                <div className="modal-actions">
                  {viewing.builtin ? (
                    <button type="button" className="btn" onClick={() => duplicate(viewing)}>
                      Duplicate &amp; edit
                    </button>
                  ) : (
                    <>
                      <button type="button" className="btn danger" onClick={() => void remove(viewing)} disabled={busy}>
                        Delete
                      </button>
                      <button type="button" className="btn" onClick={() => edit(viewing)}>
                        Edit
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => {
                      onUse(viewing.id)
                      onClose()
                    }}
                  >
                    Talk to them
                  </button>
                </div>
              </>
            ) : (
              <p className="persona-hint">Pick someone on the left, or write your own.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
