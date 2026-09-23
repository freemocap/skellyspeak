import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '../ipc/native'
import { reportFault } from '../diagnostics/faults'
import { startBrowserRecording, type BrowserRecording } from './browser-recording'
import { recordingPublished } from './recording-events'
import { beginCapture, endCapture } from './speech'
import type { LiveSpectrogram, ListeningStatus, RecordingOwner, RecordingStarted, TranscriptionInspectionResult } from '../../generated/contracts'
import type { WaveSource } from '../../domain/audio/waveform'

interface MicRecorderOptions {
  /** What this recording belongs to: a conversation, a drill item, or nothing yet. */
  owner: RecordingOwner | null
  pauseMs?: number
  onTranscribe: (text: string) => void
}

/** Recording is native-owned and bound to its owner. Only explicit Stop transcribes. */
export function useMicRecorder({ owner, onTranscribe, pauseMs }: MicRecorderOptions) {
  // The owner identity drives every effect; the value itself is read when a
  // recording actually starts, so a caller need not memoize the object.
  const ownerKey = owner ? `${owner.kind}:${owner.id}` : null
  const current = useRef(owner)
  current.current = owner
  const [lastTranscription, setLastTranscription] = useState<TranscriptionInspectionResult | null>(null)
  const [liveSpectrum, setLiveSpectrum] = useState<LiveSpectrogram | null>(null)
  const spectrumSnapshot = useRef<LiveSpectrogram | null>(null)
  const lastSpectrumPoll = useRef(0)
  const [listeningStatus, setListeningStatus] = useState<ListeningStatus | null>(null)
  const [failure, setFailure] = useState<unknown>(null)
  const continuous = useRef(false)
  const publications = useRef(0)
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
  useEffect(() => { setRecording(false); setTranscribing(false); setWaveSource(null); setLastTranscription(null); setListeningStatus(null); setLiveSpectrum(null); spectrumSnapshot.current = null; setFailure(null) }, [ownerKey])


  // Drain native samples once into the copied time-axis renderer.
  useEffect(() => {
    if ((!recording && !transcribing) || browser.current) return
    let polling = false
    const timer = setInterval(() => {
      const recordingId = active.current
      if (!recordingId || polling) return
      polling = true
      void (async () => {
        if (continuous.current) {
          const status = await invoke<ListeningStatus>('mic_listen_status', { recordingId })
          if (active.current !== recordingId) return
          if (status.recordingId !== recordingId) throw new Error('Listening status belongs to another recording.')
          setListeningStatus(status)
          if (Date.now() - lastSpectrumPoll.current >= 200) {
            lastSpectrumPoll.current = Date.now()
            const spectrum = await invoke<LiveSpectrogram | null>('mic_listen_spectrogram', { recordingId, afterSeconds: spectrumSnapshot.current?.data.frameStartSeconds.at(-1) ?? null })
            if (active.current !== recordingId) return
            if (spectrum) {
              const previous = spectrumSnapshot.current
              const times = [...(previous?.data.frameStartSeconds ?? []), ...spectrum.data.frameStartSeconds]
              const bins = [...(previous?.data.bins ?? []), ...spectrum.data.bins]
              const first = times.findIndex(time => time + spectrum.data.windowSeconds >= spectrum.endSeconds - 12)
              const merged = { ...spectrum, data: { ...spectrum.data, frameStartSeconds: times.slice(Math.max(0, first)), bins: bins.slice(Math.max(0, first)) } }
              spectrumSnapshot.current = merged
              setLiveSpectrum(merged)
            }
          }
          if (status.completed !== publications.current) {
            publications.current = status.completed
            const owner = current.current
            if (owner) recordingPublished(owner)
          }
          setRecording(status.listening)
          setTranscribing(status.processing || status.queued > 0)
          if (status.failure) setFailure(status.failure)
          if (!status.listening) {
            setWaveSource(null); release()
            if (!status.processing && status.queued === 0) active.current = null
            return
          }
        }
        const chunk = await invoke<number[]>('mic_wave', { recordingId }).catch(async error => {
          // Capture can end between the status read and waveform read.
          if (continuous.current) {
            const status = await invoke<ListeningStatus>('mic_listen_status', { recordingId })
            if (!status.listening) return []
          }
          throw error
        })
        if (active.current === recordingId) samples.current = [...samples.current, ...chunk].slice(-8192)
      })().catch(error => {
        if (active.current !== recordingId) return
        setFailure(error); reportFault('Microphone', error); cancel()
      }).finally(() => { polling = false })
    }, 100)
    return () => clearInterval(timer)
  }, [recording, transcribing, cancel, release])

  const toggleMic = useCallback(async () => {
    if (working.current) return
    const scope = generation.current
    working.current = true
    try {
      const recordingId = active.current
      if (recordingId && continuous.current) {
        await invoke('mic_listen_stop', { recordingId })
        return
      }
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
        setFailure(null); setListeningStatus(null); setLiveSpectrum(null); spectrumSnapshot.current = null; publications.current = 0
        continuous.current = pauseMs !== undefined
        capture.current = beginCapture(() => {
          if (!continuous.current) return
          setFailure(new Error('Listening stopped because the app was suspended or another view opened. Start again to continue.'))
          const id = active.current
          if (id) void invoke('mic_cancel', { recordingId: id }).catch(error => { setFailure(error); reportFault('Stopping listening', error) })
          else cancel()
        })
        const { recordingId, samplesPerSecond, browserCapture } = await invoke<RecordingStarted>(continuous.current ? 'mic_listen_start' : 'mic_start', continuous.current ? { owner, pauseMs } : { owner })
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
      if (generation.current === scope) { setFailure(error); reportFault('Microphone', error) }
    }
    finally {
      working.current = false
      if (!active.current) release()
      if (!continuous.current) setTranscribing(false)
    }
  }, [ownerKey, pauseMs, cancel, release, stopNative])

  const discardCurrent = useCallback(() => {
    const recordingId = active.current
    if (recordingId && continuous.current) {
      void invoke('mic_listen_discard', { recordingId }).catch(error => { setFailure(error); reportFault('Discarding current take', error) })
    } else cancel()
  }, [cancel])

  return { liveSpectrum, failure, listeningStatus, discardCurrent, recording, transcribing, waveSource, lastTranscription: lastTranscription && `${lastTranscription.inspection.owner.kind}:${lastTranscription.inspection.owner.id}` === ownerKey ? lastTranscription : null, toggleMic, cancel }
}
