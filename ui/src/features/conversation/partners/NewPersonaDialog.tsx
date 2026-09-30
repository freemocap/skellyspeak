import { useI18n } from '../../../components/localization/i18n'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PersonaDetails } from '../../../generated/contracts'
import { PERSONA_LIMITS } from '../../../generated/contracts'
import { DetailDialog } from '../../../components/dialogs/DetailDialog'
import { ErrorDetails } from '../../../components/feedback/ErrorDetails'
import { ActivityIndicator } from '../../../components/feedback/ActivityIndicator'
import { beginPersonaGeneration, runPersonaGeneration, cancelPersonaGeneration, nativeError } from '../../../platform/ipc/workspace'
import { reportFault } from '../../../platform/diagnostics/faults'
import { PersonaForm, type PersonaFormHandle } from './PersonaForm'
import { blankPersona, personaObjection } from './personaLimits'

/// Three ways to a new persona — write it, describe it, or ask for one — and one
/// save path. Successful generation creates the contact automatically.
export function NewPersonaDialog({ language, romanized, busy, onCreate, onClose }: {
  language: string
  /// The language has a romanization system, so the name is also given in Latin letters.
  romanized: boolean
  busy: boolean
  onCreate: (details: PersonaDetails) => Promise<void>
  onClose: () => void
}) {
  const tr = useI18n()
  const form = useRef<PersonaFormHandle>(null)
  const [draft, setDraft] = useState<PersonaDetails>(() => blankPersona(romanized))
  // The form keeps its list text locally, so a generated or cleared draft remounts it.
  const [revision, setRevision] = useState(0)
  const [brief, setBrief] = useState('')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const pending = useRef<{ id: string | null } | null>(null)
  const cancel = useCallback(async (id: string) => {
    try { await cancelPersonaGeneration(id) }
    catch (reason) { reportFault('Stopping persona generation', reason) }
  }, [])
  const abandon = useCallback(() => {
    const previous = pending.current
    pending.current = null
    if (previous?.id) void cancel(previous.id)
  }, [cancel])
  useEffect(() => {
    setGenerating(false)
    return abandon
  }, [language, abandon])
  const close = () => { if (busy || savingRef.current) return; abandon(); onClose() }
  const objection = personaObjection(draft, romanized, tr)
  const locked = busy || generating || saving
  const replace = (next: PersonaDetails) => { setDraft(next); setRevision(value => value + 1) }
  const save = async (next: PersonaDetails) => {
    if (busy || savingRef.current) return
    savingRef.current = true; setSaving(true); setSaveError(null)
    try { await onCreate(next) }
    catch (reason) { setSaveError(nativeError(reason)) }
    finally { savingRef.current = false; setSaving(false) }
  }
  const lastGeneration = useRef('')
  const generate = async (text: string) => {
    if (locked || pending.current || savingRef.current) return
    lastGeneration.current = text
    const request = { id: null as string | null }
    pending.current = request
    setGenerating(true); setGenerationError(null); setSaveError(null)
    try {
      request.id = await beginPersonaGeneration(language, text)
      // Closing can precede the admission receipt. Release that ownership as
      // soon as its ID arrives, without starting provider work.
      if (pending.current !== request) { await cancel(request.id); return }
      const details = await runPersonaGeneration(request.id)
      if (pending.current === request) {
        replace(details)
        // Provider work is complete. Closing after creation must not cancel it.
        pending.current = null; setGenerating(false)
        await save(details)
      }
    } catch (reason) {
      if (pending.current === request) setGenerationError(nativeError(reason))
    } finally {
      if (pending.current === request) { pending.current = null; setGenerating(false) }
    }
  }
  const create = () => {
    if (locked || pending.current || savingRef.current) return
    let next: PersonaDetails
    try { next = form.current?.flush() ?? draft }
    catch { return /* The form preserves and displays invalid pending input. */ }
    if (!personaObjection(next, romanized, tr)) void save(next)
  }
  const clear = () => { replace(blankPersona(romanized)); setBrief(''); setGenerationError(null); setSaveError(null) }
  return <DetailDialog title={tr("New partner")} onClose={close}>
    <form className="persona-profile" aria-label={tr("New partner")} onSubmit={event => { event.preventDefault(); create() }}>
      <h2>{tr("New partner")}</h2>
      <div className="modal-actions">
        <button type="submit" className="btn primary" disabled={locked || Boolean(objection)}>{busy || saving ? tr("Creating…") : tr("Create")}</button>
        <button type="button" className="btn" disabled={locked} onClick={clear}>{tr("Clear")}</button>
        <button type="button" className="btn" disabled={busy || saving} onClick={close}>{tr("Cancel")}</button>
      </div>
      {saveError && <ErrorDetails label={tr("Saving partner")} errorKey={saveError}>{saveError}<button type="button" className="btn" disabled={locked} onClick={create}>{tr("Retry save")}</button></ErrorDetails>}
      <div className="persona-generate">
        <textarea className="field" rows={3} aria-label={tr("Describe them")} maxLength={PERSONA_LIMITS.briefMax} value={brief} disabled={locked} dir="auto"
          placeholder={tr("Describe them (optional), e.g. retired fisherman who distrusts tourists")}
          onChange={event => setBrief(event.target.value)} />
        <div className="persona-generate-actions">
          <button type="button" className="btn" disabled={locked || !brief.trim()} onClick={() => void generate(brief)}>{tr("Generate")}</button>
          <button type="button" className="btn" disabled={locked} onClick={() => void generate('')}>{tr("Surprise me")}</button>
          {generating && <ActivityIndicator compact label={tr("Generating a partner…")} />}
        </div>
      </div>
      {generationError && <ErrorDetails onRetry={() => generate(lastGeneration.current)} label={tr("Generating a partner")} errorKey={generationError}>{generationError}</ErrorDetails>}
      <fieldset disabled={locked}>
        <PersonaForm ref={form} key={revision} draft={draft} romanized={romanized} onChange={setDraft} onCommit={setDraft} />
      </fieldset>
      {objection && <p className="persona-hint" role="status">{objection}</p>}
    </form>
  </DetailDialog>
}
