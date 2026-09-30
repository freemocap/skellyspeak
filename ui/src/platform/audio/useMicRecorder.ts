import { bindRewardOrigin, captureRewardOrigin, inheritRewardOrigin } from '../ipc/reward-origin'
import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '../ipc/native'
import { reportFault } from '../diagnostics/faults'
import { startBrowserRecording, type BrowserRecording } from './browser-recording'
import { recordingPublished } from './recording-events'
import { beginCapture, endCapture } from './speech'
import type { LiveSpectrogram, ListeningMode, ListeningSettings, ListeningStatus, RecordingOwner, RecordingStarted, TranscriptionInspectionResult } from '../../generated/contracts'
import type { WaveSource } from '../../domain/audio/waveform'
import { createSpectrumFeed, mergeSpectrum } from '../../domain/audio/spectrum-feed'

/** A stopped manual clip exists before capture delivery or transcription returns. */
export interface PendingRecording {
  recordingId: string
  state: 'processing' | 'completed' | 'failed'
  failure: unknown
}

interface MicRecorderOptions {
  /** What this recording belongs to: a conversation, a drill item, or nothing yet. */
  owner: RecordingOwner | null
  /** Present for a continuous microphone with independently controlled clip boundaries. */
  listening?: ListeningSettings
  captureMode?: ListeningMode
  onTranscribe: (text: string, result: TranscriptionInspectionResult) => void
}

/** Recording is native-owned and bound to its owner. Native clip receipts precede transcription. */
export function useMicRecorder({ owner, onTranscribe, listening, captureMode }: MicRecorderOptions) {
  // The owner identity drives every effect; the value itself is read when a
  // recording actually starts, so a caller need not memoize the object.
  const ownerKey = owner ? `${owner.kind}:${owner.id}` : null
  const current = useRef(owner)
  current.current = owner
  const [lastTranscription, setLastTranscription] = useState<TranscriptionInspectionResult | null>(null)
  // Every recording shows its live spectrogram: a listening run reports it through its
  // session, a single recording through its own analysis. Only the stream subscribes.
  const [spectrum] = useState(createSpectrumFeed)
  const [listeningStatus, setListeningStatus] = useState<ListeningStatus | null>(null)
  const [pendingRecordings, setPendingRecordings] = useState<PendingRecording[]>([])
  const [failure, setFailure] = useState<unknown>(null)
  const continuous = useRef(false)
  const publications = useRef(0)
  const [starting, setStarting] = useState(false)
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
  // Read when listening starts; later changes go to native through `tune`.
  const listeningSettings = useRef(listening)
  listeningSettings.current = listening
  const captureModeRef = useRef(captureMode)
  captureModeRef.current = captureMode

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
  useEffect(() => { setRecording(false); setTranscribing(false); setWaveSource(null); setLastTranscription(null); setListeningStatus(null); setPendingRecordings([]); spectrum.set(null); setFailure(null) }, [ownerKey, spectrum])


  // Drain native samples once into the copied time-axis renderer.
  useEffect(() => {
    if ((!recording && !transcribing) || (browser.current && !continuous.current)) return
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
          for (const take of status.takes) inheritRewardOrigin(take.recordingId, recordingId)
          setListeningStatus(status)
          if (status.completed !== publications.current) {
            publications.current = status.completed
            const owner = current.current
            if (owner) recordingPublished(owner)
          }
          setRecording(status.listening)
          setTranscribing(status.processing || status.queued > 0)
          if (status.failure) setFailure(status.failure)
          if (!status.listening) {
            browser.current?.cancel(); browser.current = null
            setWaveSource(null); release()
            if (!status.processing && status.queued === 0) active.current = null
            return
          }
        }
        if (browser.current) return
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

  // Spectrogram computation can be slow. Never let it hold up take receipts.
  useEffect(() => {
    if (!recording) return
    let polling = false
    const timer = setInterval(() => {
      const recordingId = active.current
      if (!recordingId || polling) return
      polling = true
      void (async () => {
        const afterSeconds = spectrum.get()?.data.frameStartSeconds.at(-1) ?? null
        const next = continuous.current
          ? await invoke<LiveSpectrogram | null>('mic_listen_spectrogram', { recordingId, afterSeconds })
          : await invoke<LiveSpectrogram | null>('mic_spectrogram', { recordingId, afterSeconds })
        if (active.current !== recordingId) return
        if (next) spectrum.set(mergeSpectrum(spectrum.get(), next))
      })().catch(error => {
        if (active.current !== recordingId) return
        setFailure(error); reportFault('Microphone spectrum', error); cancel()
      }).finally(() => { polling = false })
    }, 50)
    return () => clearInterval(timer)
  }, [recording, cancel, spectrum])

  const toggleMic = useCallback(async () => {
    const rewardOrigin = captureRewardOrigin()
    if (working.current) return
    const scope = generation.current
    working.current = true
    let stoppedRecordingId: string | null = null
    try {
      const recordingId = active.current
      if (recordingId && continuous.current) {
        const capture = browser.current; browser.current = null
        try { await capture?.finish() } catch (error) { await stopNative(recordingId); active.current = null; setRecording(false); throw error }
        if (generation.current !== scope) return
        try { await invoke('mic_listen_stop', { recordingId }) }
        catch (error) { cancel(); throw error }
        return
      }
      if (recordingId) {
        bindRewardOrigin(recordingId, rewardOrigin)
        stoppedRecordingId = recordingId
        // Every owner keeps the take's identity (Practice's attempt row, the
        // conversation's pending message) until its text arrives or fails.
        setPendingRecordings(takes => [...takes, { recordingId, state: 'processing', failure: null }])
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
        setPendingRecordings(takes => takes.map(take => take.recordingId === recordingId ? { ...take, state: 'completed' } : take))
        setLastTranscription(result)
        if (result.text.trim()) callback.current(result.text, result)
      } else {
        setStarting(true)
        const owner = current.current
        if (!owner) throw new Error('Open a conversation or a drill item before recording.')
        setFailure(null); setListeningStatus(null); spectrum.set(null); publications.current = 0
        const settings = listeningSettings.current
        continuous.current = settings !== undefined
        capture.current = beginCapture(() => {
          if (!continuous.current) return
          setFailure(new Error('Listening stopped because the app was suspended or another view opened. Start again to continue.'))
          const id = active.current
          browser.current?.cancel(); browser.current = null
          if (id) void invoke('mic_cancel', { recordingId: id }).catch(error => { setFailure(error); reportFault('Stopping listening', error) })
          else cancel()
        })
        const { recordingId, samplesPerSecond, browserCapture, browserDeviceId } = await invoke<RecordingStarted>(settings ? 'mic_listen_start' : 'mic_start', settings ? { owner, settings, ...(captureModeRef.current ? { captureMode: captureModeRef.current } : {}) } : { owner })
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
            // A listening run hands native all of its audio; a single recording keeps its
            // WAV and sends native copies only for the live spectrogram.
            const capture = await startBrowserRecording(error => { setFailure(error); reportFault('Microphone', error); cancel() }, settings
              ? (samples, sampleRate, sequence) => invoke('mic_listen_push', { recordingId, samples, sampleRate, sequence }) : undefined, browserDeviceId,
              settings ? undefined : (samples, sampleRate, sequence) => invoke('mic_push', { recordingId, samples, sampleRate, sequence }))
            if (generation.current !== scope) { capture.cancel(); await stopNative(recordingId); return }
            browser.current = capture
          } catch (error) { await stopNative(recordingId); throw error }
        }
        bindRewardOrigin(recordingId, rewardOrigin)
        active.current = recordingId
        samples.current = []
        setWaveSource(browser.current?.wave ?? { samplesPerSecond, read: () => samples.current.splice(0) })
        setRecording(true)
      }
    } catch (error) {
      release()
      if (generation.current === scope) {
        if (stoppedRecordingId) setPendingRecordings(takes => takes.map(take => take.recordingId === stoppedRecordingId ? { ...take, state: 'failed', failure: error } : take))
        setFailure(error); reportFault('Microphone', error)
      }
    }
    finally {
      working.current = false
      setStarting(false)
      if (!active.current) release()
      if (!continuous.current) setTranscribing(false)
    }
  }, [ownerKey, cancel, release, stopNative, spectrum])

  const stopMic = useCallback(async () => {
    if (active.current) await toggleMic()
  }, [toggleMic])

  /** Sends a failed take's audio for transcription again: native holds the audio
   * of a failed take for this. The retried attempt has its own identity; the take
   * keeps its own, and its text is passed on as a first transcription's is. */
  const retry = useCallback(async (recordingId: string) => {
    bindRewardOrigin(recordingId)
    if (working.current || active.current) return
    const scope = generation.current
    const retryOwner = current.current
    const mark = (take: Partial<PendingRecording>) => setPendingRecordings(takes => takes.map(item => item.recordingId === recordingId ? { ...item, ...take } : item))
    working.current = true
    mark({ state: 'processing', failure: null })
    setFailure(null); setTranscribing(true)
    try {
      const result = await invoke<TranscriptionInspectionResult>('mic_retry_transcription', { recordingId }).catch(error => {
        if (retryOwner?.kind === 'drillItem') recordingPublished(retryOwner)
        throw error
      })
      recordingPublished(result.inspection.owner)
      if (generation.current !== scope) return
      if (`${result.inspection.owner.kind}:${result.inspection.owner.id}` !== ownerKey) throw new Error('Recording inspection belongs to a different owner.')
      mark({ state: 'completed' })
      setLastTranscription(result)
      if (result.text.trim()) callback.current(result.text, result)
    } catch (error) {
      if (generation.current === scope) { mark({ state: 'failed', failure: error }); setFailure(error); reportFault('Microphone', error) }
    } finally {
      working.current = false
      setTranscribing(false)
    }
  }, [ownerKey])

  const discardCurrent = useCallback(() => {
    const recordingId = active.current
    if (recordingId && continuous.current) {
      void invoke('mic_listen_discard', { recordingId }).catch(error => { setFailure(error); reportFault('Discarding current take', error) })
    } else cancel()
  }, [cancel])

  /** Move the pause, threshold or shortest take of the run in progress. */
  const tune = useCallback((settings: ListeningSettings, captureMode?: ListeningMode) => {
    const recordingId = active.current
    if (!recordingId || !continuous.current) throw new Error('Listening settings can only be tuned while listening.')
    void invoke('mic_listen_tune', { recordingId, settings, ...(captureMode ? { captureMode } : {}) }).catch(error => { setFailure(error); reportFault('Tuning listening', error) })
  }, [])

  return { starting, pendingRecordings, tune, spectrum, failure, listeningStatus, discardCurrent, recording, transcribing, waveSource, lastTranscription: lastTranscription && `${lastTranscription.inspection.owner.kind}:${lastTranscription.inspection.owner.id}` === ownerKey ? lastTranscription : null, toggleMic, stopMic, retry, cancel }
}
