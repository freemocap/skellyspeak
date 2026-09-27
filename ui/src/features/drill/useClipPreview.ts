import { useEffect, useState } from 'react'
import type { ListeningStatus, LiveSpectrogram } from '../../generated/contracts'
import { invoke } from '../../platform/ipc/native'

export interface ClipPreview { recordingId: string; number: number; spectrum: LiveSpectrogram }

/** A cut is visible before transcription. Keep it while its saved take hydrates. */
export function useClipPreview(ownerId: string | null, status: ListeningStatus | null) {
  const [value, setValue] = useState<{ ownerId: string; preview: ClipPreview } | null>(null)
  const [failure, setFailure] = useState<unknown>(null)
  const [retries, setRetries] = useState(0)
  const latest = status?.takes.at(-1)
  useEffect(() => { setFailure(null) }, [ownerId])
  useEffect(() => {
    if (!ownerId || !status || !latest) return
    let current = true
    setFailure(null)
    void invoke<LiveSpectrogram>('mic_listen_spectrogram', { recordingId: status.recordingId, takeId: latest.recordingId, afterSeconds: null })
      .then(spectrum => { if (current) setValue({ ownerId, preview: { recordingId: latest.recordingId, number: latest.number, spectrum } }) })
      .catch(error => { if (current) setFailure(error) })
    return () => { current = false }
  }, [ownerId, status?.recordingId, latest?.recordingId, retries])
  return { preview: value?.ownerId === ownerId ? value.preview : null, failure, retry: () => setRetries(value => value + 1) }
}
