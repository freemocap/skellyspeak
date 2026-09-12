import { useState } from 'react'
import { invoke } from '../platform/ipc/tauri'
import { nativeError } from '../platform/ipc/workspace'

/// Copies the local workspace into a folder in Downloads and says where it went.
/// Offered wherever the learner might lose their data: beside Factory Reset in
/// Settings, and on the screen shown when the workspace cannot be opened.
export function SaveDataCopy() {
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
      title="Copies your local data into a folder in Downloads. Nothing is changed or deleted."
      onClick={() => { void save() }}>
      {saving ? 'Saving…' : 'Save a copy of my data'}
    </button>
    {savedTo && <p role="status">Saved to {savedTo}</p>}
    {failure && <p role="alert">{failure}</p>}
  </div>
}
