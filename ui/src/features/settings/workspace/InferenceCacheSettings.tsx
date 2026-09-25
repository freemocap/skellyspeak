import { useEffect, useState } from 'react'
import type { CacheSettings } from '../../../generated/contracts'
import { invoke } from '../../../platform/ipc/tauri'
import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import { errorMessage } from '../../../platform/diagnostics/error-details'
import { useI18n } from '../../../components/localization/i18n'

const MIB = 1024 * 1024
export function InferenceCacheSettings() {
  const tr = useI18n()
  const [settings, setSettings] = useState<CacheSettings | null>(null)
  const [capacity, setCapacity] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let current = true
    void invoke<CacheSettings>('get_inference_cache_settings').then(value => {
      if (current) { setSettings(value); setCapacity(String(value.capacityBytes / MIB)) }
    }).catch(failure => { if (current) setError(errorMessage(failure)) })
    return () => { current = false }
  }, [])
  const save = async () => {
    const value = Number(capacity)
    if (capacity.trim() === '' || !Number.isInteger(value) || value < 0 || value > 100000) {
      setError(tr('Enter a whole number from 0 to 100000.')); return
    }
    setBusy(true); setError(null)
    try { setSettings(await invoke<CacheSettings>('save_inference_cache_settings', { capacityBytes: value * MIB })) }
    catch (failure) { setError(errorMessage(failure)) }
    finally { setBusy(false) }
  }
  return <div>
    <div className="form-row">
      <label>{tr('Cache capacity (MiB)')} <input className="field" type="number" min="0" max="100000" step="1"
        value={capacity} disabled={!settings || busy} onChange={event => setCapacity(event.target.value)} /></label>
      <button className="btn" type="button" disabled={!settings || busy || Number(capacity) * MIB === settings.capacityBytes}
        onClick={() => void save()}>{tr('Apply')}</button>
    </div>
    {settings && <p>{tr('Cached: {value0} MiB · results: {value1}', { value0: tr.number(settings.usedBytes / MIB, { maximumFractionDigits: 1 }), value1: tr.number(settings.resultCount) })}</p>}
    <details><summary>{tr('Cache details')}</summary><p>{tr('Shared across the app. Least recently used results are removed first. Zero disables retained caching. Recordings, accepted records and execution receipts are retained separately.')}</p></details>
    {error && <ErrorNotice error={error}>{error}</ErrorNotice>}
  </div>
}
