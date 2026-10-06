import { MicrophoneTest } from './MicrophoneTest'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '../localization/i18n'
import { ActivityIndicator } from '../feedback/ActivityIndicator'
import { ErrorNotice } from '../feedback/ErrorNotice'
import { listMicrophones } from '../../platform/audio/microphones'
import { errorMessage } from '../../platform/diagnostics/error-details'
import { reportFault } from '../../platform/diagnostics/faults'
import type { MicrophoneList } from '../../generated/contracts'

/** Shared device picker; owners decide whether changes save immediately or edit a draft. */
export function MicrophoneSelector({ value, onChange, disabled = false }: {
  value: string | null; onChange: (value: string | null) => void; disabled?: boolean
}) {
  const tr = useI18n()
  const [mics, setMics] = useState<MicrophoneList | null>(null)
  const [micError, setMicError] = useState<unknown>(null)
  const refreshing = useRef(false)
  const [loading, setLoading] = useState(false)
  const listMics = useCallback(async (requestAccess: boolean) => {
    if (refreshing.current) return
    refreshing.current = true; setLoading(true)
    try { setMics(await listMicrophones(requestAccess)); setMicError(null) }
    catch (error) { setMicError(error); reportFault('Listing microphones', error) }
    finally { refreshing.current = false; setLoading(false) }
  }, [])
  useEffect(() => { void listMics(false) }, [listMics])
  const systemMicrophone = mics?.devices.find(device => device.isDefault)
  const missingMicrophone = mics && value !== null && !mics.devices.some(device => device.id === value) ? value : null
  return (
        <div className="form-row">
          <label>{tr("Microphone")}</label>
          <div className="microphone-row">
            <select
              value={value ?? ''}
              disabled={disabled}
              aria-label={tr("Microphone")}
              onChange={event => onChange(event.target.value || null)}
            >
              <option value="">{systemMicrophone ? tr("System default · {value0}", { value0: systemMicrophone.label }) : tr("System default")}</option>
              {mics?.devices.map((d, index) => {
                const label = d.label || tr("Microphone {value0}", { value0: index + 1 })
                return <option key={d.id} value={d.id}>
                  {d.channels !== null && d.sampleRate !== null
                    ? tr("{value0} · {value1} ch · {value2} Hz", { value0: label, value1: d.channels, value2: d.sampleRate.toLocaleString(tr.browserLocale) })
                    : label}
                </option>
              })}
              {missingMicrophone !== null && <option value={missingMicrophone}>{tr("{value0} (not connected)", { value0: missingMicrophone })}</option>}
            </select>
            <button type="button" className="btn" disabled={disabled || loading} aria-busy={loading} aria-label={tr("Refresh microphones")} title={tr("Refresh microphones")} onClick={() => void listMics(true)}>
              {loading ? <ActivityIndicator label={tr('Loading…')} compact /> : '↻'}
            </button>
          </div>
          <MicrophoneTest device={value} disabled={disabled} />
          {micError !== null && <ErrorNotice as="p" error={micError}>{errorMessage(micError)}</ErrorNotice>}
        </div>
  )
}
