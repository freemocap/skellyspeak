import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import { AssessmentInfo } from './AssessmentInfo'
import { errorMessage as message } from '../../../platform/diagnostics/error-details'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../../components/localization/i18n'
import { invoke } from '../../../platform/ipc/native'
import type { ConnectionConfig } from '../../../generated/contracts'

// Provider identifier, displayed verbatim.
const jevModel = 'typesafe/jev-1.13'
const fields = ['standardModel', 'fastModel'] as const
const labels = ['Standard model', 'Fast model'] as const
type Models = Pick<ConnectionConfig, typeof fields[number] | 'audio' | 'assessmentAdapter'>


/** Shared model preferences have no dependency on access settings or credentials. */
export function SettingsModels({ onBusyChange, onChanged, refreshKey = 0 }: {
  onBusyChange: (busy: boolean) => void
  onChanged: () => Promise<void>
  refreshKey?: number
}) {
  const tr = useI18n()
  const [saved, setSaved] = useState<ConnectionConfig | null>(null)
  const [draft, setDraft] = useState<Models | null>(null)
  const [editing, setEditing] = useState(false)
  const [customTranscription, setCustomTranscription] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const writing = useRef(false)
  const dirty = !!saved && !!draft && (draft.assessmentAdapter !== saved.assessmentAdapter || fields.some(key => draft[key] !== saved[key]) ||
    (['transcription', 'speech'] as const).some(key => draft.audio[key].model !== saved.audio[key].model))

  async function read() {
    const config = await invoke<ConnectionConfig>('get_connection')
    setSaved(config); setDraft(config)
  }
  useEffect(() => { void read().catch(error => setError(message(error))) }, [refreshKey])
  useEffect(() => { onBusyChange(busy || dirty); return () => onBusyChange(false) }, [busy, dirty, onBusyChange])
  async function save() {
    if (!saved || !draft || writing.current) return
    writing.current = true; setBusy(true); setError(null)
    try {
      const config = await invoke<ConnectionConfig>('save_models', {
        expectedRevision: saved.revision,
        ...Object.fromEntries(fields.map(key => [key, draft[key]])),
        audio: draft.audio,
        assessmentAdapter: draft.assessmentAdapter,
      })
      setSaved(config); setDraft(config)
      await onChanged(); setStatus('Saved')
    } catch (error) { setError(message(error)) }
    finally { writing.current = false; setBusy(false) }
  }
  useEffect(() => {
    if (!dirty || busy || editing || error) return
    const timer = setTimeout(() => void save(), 500)
    return () => clearTimeout(timer)
  }, [draft, dirty, busy, editing, error])

  if (!draft) return <div role="status">{error ? <><ErrorNotice as="p" error={error}>{error}</ErrorNotice><button className="btn" onClick={() => void read().catch(error => setError(message(error)))}>{tr('Retry save')}</button></> : tr('Models')}</div>
  return <section aria-label={tr('Models')}>
    <div className="form-row">
      <span className="assessment-label"><label htmlFor="assessment-adapter">{tr('Skill assessment')}</label><AssessmentInfo /></span>
      <select id="assessment-adapter" className="field" value={draft.assessmentAdapter} disabled
        onChange={event => { setDraft({ ...draft, assessmentAdapter: event.target.value as ConnectionConfig['assessmentAdapter'] }); setError(null); setStatus('') }}>
        <option value="jev_choice" disabled>{tr('Jev Choice')} — {tr('Disabled')}</option>
        <option value="chat_model">{tr('Chat model assessment')}</option>
      </select>
      <span className="detail-meta">{draft.assessmentAdapter === 'jev_choice' ? jevModel : draft.fastModel}</span>
    </div>
    {fields.map((key, index) => <div className="form-row" key={key}>
      <label htmlFor={`model-${key}`}>{tr(labels[index])}</label>
      <input id={`model-${key}`} className="field" value={draft[key]} disabled={busy}
        onFocus={() => setEditing(true)}
        onBlur={() => { setDraft(current => current && ({ ...current, [key]: current[key].trim() })); setEditing(false) }}
        onChange={event => { setDraft({ ...draft, [key]: event.target.value }); setError(null); setStatus('') }} />
    </div>)}
    {(['transcription', 'speech'] as const).map(kind => <fieldset key={kind}>
      <legend>{tr(kind === 'transcription' ? 'Transcription model' : 'Read aloud')}</legend>
      {kind === 'transcription' && <div className="form-row">
        <label htmlFor="transcription-preset">{tr('Model')}</label>
        <select id="transcription-preset" className="field" disabled={busy}
          value={!customTranscription && ['whisper-large-v3', 'scribe_v2'].includes(draft.audio.transcription.model) ? draft.audio.transcription.model : 'custom'}
          onChange={event => {
            if (event.target.value === 'custom') { setCustomTranscription(true); return }
            setCustomTranscription(false)
            setDraft({ ...draft, audio: { ...draft.audio, transcription: { model: event.target.value } } })
            setEditing(false); setError(null); setStatus('')
          }}>
          <option value="whisper-large-v3">{tr('Whisper Large v3 · Groq')}</option>
          <option value="scribe_v2">{tr('Scribe v2 · ElevenLabs')}</option>
          <option value="custom">{tr('Customize…')}</option>
        </select>
      </div>}
      {(kind !== 'transcription' || customTranscription || !['whisper-large-v3', 'scribe_v2'].includes(draft.audio.transcription.model)) && <div className="form-row">
        <label htmlFor={`audio-model-${kind}`}>{tr(kind === 'transcription' ? 'Transcription model' : 'Read-aloud model')}</label>
        <input id={`audio-model-${kind}`} className="field" value={draft.audio[kind].model} disabled={busy}
          onFocus={() => setEditing(true)}
          onBlur={() => { setDraft(current => current && ({ ...current, audio: { ...current.audio, [kind]: { ...current.audio[kind], model: current.audio[kind].model.trim() } } })); setEditing(false) }}
          onChange={event => { setDraft({ ...draft, audio: { ...draft.audio, [kind]: { ...draft.audio[kind], model: event.target.value } } }); setError(null); setStatus('') }} />
      </div>}
    </fieldset>)}
    {dirty && <div className="form-row"><span role="status">{busy ? tr('Saving…') : editing ? tr('Editing — saves when you leave the field') : tr('Unsaved changes')}</span>
      <button className="btn" disabled={busy} onClick={() => { setDraft(saved); setError(null); setEditing(false); setStatus('Changes discarded') }}>{tr('Discard changes')}</button></div>}
    {error && <ErrorNotice as="div" error={error}>{error}<button className="btn" disabled={busy} onClick={() => void save()}>{tr('Retry save')}</button></ErrorNotice>}
    {status && <p role="status">{tr(status)}</p>}
  </section>
}
