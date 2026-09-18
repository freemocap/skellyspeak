import { useI18n } from '../../../components/localization/i18n'
import { useRef } from 'react'
import type { Persona, PersonaDetails } from '../../../generated/contracts'
import { DetailDialog } from '../../../components/dialogs/DetailDialog'
import { PersonaProfile, type PersonaProfileHandle } from './PersonaProfile'

export function PersonaProfileDialog({ persona, language, romanized, onSave, onNewPersona, onClose }: {
  persona: Persona; language: string; romanized: boolean
  onSave: (persona: Persona, details: PersonaDetails) => Promise<Persona>
  /// Leave this persona and start a new one.
  onNewPersona: () => void
  onClose: () => void
}) {
  const tr = useI18n()
  const editor = useRef<PersonaProfileHandle>(null)
  const closing = useRef(false)
  const close = async (afterClose = onClose) => {
    if (closing.current || !editor.current) return
    closing.current = true
    try { await editor.current.flush(); afterClose() }
    catch { /* Validation/save failure stays visible with its draft. */ }
    finally { closing.current = false }
  }
  return <DetailDialog title={tr("Persona")} onClose={() => { void close() }}>
    <div className="persona-dialog-head">
      <h2>{tr("Persona")}</h2>
      <button type="button" className="btn" onClick={() => { void close(onNewPersona) }}>{tr("New persona…")}</button>
    </div>
    <PersonaProfile ref={editor} persona={persona} language={language} romanized={romanized} onSave={onSave} />
  </DetailDialog>
}
