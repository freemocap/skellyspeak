import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '../ipc/native'
import { reportFault } from '../diagnostics/faults'
import { startBrowserRecording, type BrowserRecording } from './browser-recording'
import { recordingPublished } from './recording-events'
import { beginCapture, endCapture } from './speech'
import type { RecordingOwner, RecordingStarted, TranscriptionInspectionResult } from '../../generated/contracts'
import type { WaveSource } from '../../domain/audio/waveform'

interface MicRecorderOptions {
  /** What this recording belongs to: a conversation, a drill item, or nothing yet. */
  owner: RecordingOwner | null
  onTranscribe: (text: string) => void
}

/** Recording is native-owned and bound to its owner. Only explicit Stop transcribes. */
export function useMicRecorder({ owner, onTranscribe }: MicRecorderOptions) {
  // The owner identity drives every effect; the value itself is read when a
  // recording actually starts, so a caller need not memoize the object.
  const ownerKey = owner ? `${owner.kind}:${owner.id}` : null
  const current = useRef(owner)
  current.current = owner
  const [lastTranscription, setLastTranscription] = useState<TranscriptionInspectionResult | null>(null)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [waveSource, setWaveSource] = useState<WaveSource | null>(null)
  const browser = useRef<BrowserRecording | null>(null)
  const active = useRef<string | null>(null)
  const working = useRef(false)
  const samples = useRef<number[]>([])
  const generation = useRef(0)
  const callback = useRef(onTranscribe)
  callback.current = onTranscribe

  // The microphone and the speakers are one authority: a recording stops
  // playback and holds it off until the recording ends, whatever owns it.
  const capture = useRef<object | null>(null)
  const stopping = useRef(0)
  const release = useCallback(() => {
    if (stopping.current) return
    if (capture.current) { endCapture(capture.current); capture.current = null }
  }, [])
  const stopNative = useCallback(async (recordingId: string) => {
    stopping.current++
    // On failure retain exclusion: native capture has not acknowledged stopping.
    await invoke('mic_cancel', { recordingId })
    stopping.current--
    release()
  }, [release])
  const cancel = useCallback(() => {
    browser.current?.cancel(); browser.current = null
    generation.current++
    const recordingId = active.current
    active.current = null
    setRecording(false); setWaveSource(null)
    if (recordingId) void stopNative(recordingId).catch(error => reportFault('Stopping the microphone', error))
    else if (!working.current) release()
  }, [release, stopNative])
  useEffect(() => () => cancel(), [ownerKey, cancel])
  useEffect(() => { setRecording(false); setWaveSource(null); setLastTranscription(null) }, [ownerKey])

  // Drain native samples once into the copied time-axis renderer.
  useEffect(() => {
    if (!recording || browser.current) return
    let polling = false
    const timer = setInterval(() => {
      const recordingId = active.current
      if (!recordingId || polling) return
      polling = true
      void invoke<number[]>('mic_wave', { recordingId })
        .then(chunk => { if (active.current === recordingId) samples.current = [...samples.current, ...chunk].slice(-8192) })
        .catch(error => {
          if (active.current !== recordingId) return
          reportFault('Microphone level meter', error)
          cancel()
        }).finally(() => { polling = false })
    }, 100)
    return () => clearInterval(timer)
  }, [recording, cancel])

  const toggleMic = useCallback(async () => {
    if (working.current) return
    const scope = generation.current
    working.current = true
    try {
      const recordingId = active.current
      if (recordingId) {
        active.current = null; setRecording(false); setWaveSource(null); setTranscribing(true)
        // Keep exclusion until native acknowledges the stop/transcription call.
        // Cancelling or changing owner must not release while hardware is live.
        const capture = browser.current; browser.current = null
        let audioBase64: string | undefined
        try { audioBase64 = await capture?.finish() }
        catch (error) { await stopNative(recordingId); throw error }
        if (generation.current !== scope) { await stopNative(recordingId); return }
        const result = await invoke<TranscriptionInspectionResult>('mic_transcribe', { recordingId, ...(audioBase64 ? { audioBase64 } : {}) }).catch(error => {
          // A post-publication storage cleanup can fail after the attempt is durable.
          // Refresh its owner even on failure; never repeat provider work to save it.
          if (owner?.kind === 'drillItem') recordingPublished(owner)
          throw error
        })
        recordingPublished(result.inspection.owner)
        if (generation.current !== scope) return
        if (result.inspection.recordingId !== recordingId || `${result.inspection.owner.kind}:${result.inspection.owner.id}` !== ownerKey) {
          throw new Error('Recording inspection belongs to a different recording or owner.')
        }
        setLastTranscription(result)
        if (result.text.trim()) callback.current(result.text)
      } else {
        const owner = current.current
        if (!owner) throw new Error('Open a conversation or a drill item before recording.')
        capture.current = beginCapture()
        const { recordingId, samplesPerSecond, browserCapture } = await invoke<RecordingStarted>('mic_start', { owner })
        if (generation.current !== scope) {
          await stopNative(recordingId)
          return
        }
        if (!Number.isFinite(samplesPerSecond) || samplesPerSecond <= 0) {
          await stopNative(recordingId)
          throw new Error('Native recording returned an invalid waveform sample rate.')
        }
        if (browserCapture) {
          try {
            const capture = await startBrowserRecording(error => { reportFault('Microphone', error); cancel() })
            if (generation.current !== scope) { capture.cancel(); await stopNative(recordingId); return }
            browser.current = capture
          } catch (error) { await stopNative(recordingId); throw error }
        }
        active.current = recordingId
        samples.current = []
        setWaveSource(browser.current?.wave ?? { samplesPerSecond, read: () => samples.current.splice(0) })
        setRecording(true)
      }
    } catch (error) {
      release()
      if (generation.current === scope) reportFault('Microphone', error)
    }
    finally {
      working.current = false
      if (!active.current) release()
      setTranscribing(false)
    }
  }, [ownerKey, cancel, release, stopNative])

  return { recording, transcribing, waveSource, lastTranscription: lastTranscription && `${lastTranscription.inspection.owner.kind}:${lastTranscription.inspection.owner.id}` === ownerKey ? lastTranscription : null, toggleMic, cancel }
}
