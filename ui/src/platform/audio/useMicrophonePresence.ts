import { useEffect, useState } from 'react'
import type { MicrophoneList } from '../../generated/contracts'
import { errorMessage } from '../diagnostics/error-details'
import { reportFault } from '../diagnostics/faults'
import { listMicrophones } from './microphones'

/** Whether the saved microphone choice can be recorded from right now. */
export interface MicrophonePresence {
  /** `missing` covers an unplugged device, one the system cannot open, and no input at all. */
  state: 'connected' | 'missing' | 'unknown'
  /** The device's name when the list gives one; the default choice takes the system default's. */
  label: string | null
  /** The system's reason a listed device cannot open, or why the list could not be read. */
  detail: string | null
}

/** Reads one device list against the saved choice (`null` is the system default). */
export function presenceOf(list: MicrophoneList, device: string | null): MicrophonePresence {
  const found = list.devices.find(entry => device === null ? entry.isDefault : entry.id === device)
  if (device === null && !found) {
    if (!list.devices.length) return { state: 'missing', label: null, detail: null }
    // Browser inventories can contain inputs without identifying a default.
    return { state: 'connected', label: null, detail: null }
  }
  if (!found) return { state: 'missing', label: null, detail: null }
  if (found.unavailable !== null) return { state: 'missing', label: found.label || null, detail: found.unavailable }
  return { state: 'connected', label: found.label || null, detail: null }
}

/** Tracks whether the saved microphone choice is present: listed on mount, when
 * the choice changes and when the platform reports a device change. It never
 * asks for microphone access, so browser lists may leave names empty until a
 * recording grants it. `undefined` means the owner has no choice to track yet. */
export function useMicrophonePresence(device: string | null | undefined): MicrophonePresence | null {
  const [presence, setPresence] = useState<MicrophonePresence | null>(null)
  useEffect(() => {
    if (device === undefined) { setPresence(null); return }
    let alive = true
    const refresh = () => {
      listMicrophones(false).then(list => { if (alive) setPresence(presenceOf(list, device)) }, (error: unknown) => {
        if (!alive) return
        reportFault('Listing microphones', error)
        setPresence({ state: 'unknown', label: null, detail: errorMessage(error) })
      })
    }
    refresh()
    const devices = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices
    devices?.addEventListener?.('devicechange', refresh)
    return () => { alive = false; devices?.removeEventListener?.('devicechange', refresh) }
  }, [device])
  return presence
}
