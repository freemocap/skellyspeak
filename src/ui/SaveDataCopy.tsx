import { useI18n } from './i18n'
import { useState } from 'react'
import { invoke } from '../platform/ipc/tauri'
import { nativeError } from '../platform/ipc/workspace'

/// Copies the local database and its SQLite sidecars into a folder in Downloads and says where it went.
/// Offered wherever the learner might lose their data: beside Factory Reset in
/// Settings, and on the screen shown when the workspace cannot be opened.
export function SaveDataCopy() {
  const tr = useI18n()
  const [saving, setSaving] = useState(false)
  const [savedTo, setSavedTo] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const save = async () => {
    if (saving) return
    setSaving(true); setFailure(null)
    try { setSavedTo(await invoke<string>('export_workspace')) }
    catch (reason) { setFailure(nativeError(reason)) }
    finally { setSaving(false) }
  }
  return <div className="save-data-copy">
    <button type="button" className="btn" disabled={saving}
      title={tr("Copies the database into Downloads. Editable configuration files are not included.")}
      onClick={() => { void save() }}>
      {saving ? tr("Saving…") : tr("Save a copy of my data")}
    </button>
    <p>{tr("Copies the database and its supporting files to Downloads. Editable configuration files are separate and are not included; copy those files separately to keep them.")}</p>
    {savedTo && <p role="status">{tr("Saved to ")}{savedTo}</p>}
    {failure && <p role="alert">{failure}</p>}
  </div>
}
