import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '../../platform/ipc/native'
import { reportFault } from '../../platform/diagnostics/faults'
import { startBrowserRecording, type BrowserRecording } from '../../domain/audio/browser-recording'
import type { RecordingStarted } from '../../contracts'
import type { WaveSource } from '../../domain/audio/waveform'

interface MicRecorderOptions {
  conversationId: string | null
  onTranscribe: (text: string) => void
}

/** Recording is native-owned and bound to its conversation. Only explicit Stop transcribes. */
export function useMicRecorder({ conversationId, onTranscribe }: MicRecorderOptions) {
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

  const cancel = useCallback(() => {
    browser.current?.cancel(); browser.current = null
    generation.current++
    const recordingId = active.current
    active.current = null
    setRecording(false); setWaveSource(null)
    if (recordingId) void invoke('mic_cancel', { recordingId }).catch(error => reportFault('Stopping the microphone', error))
  }, [])
  useEffect(() => {
    return () => {
      browser.current?.cancel(); browser.current = null
    generation.current++
      const recordingId = active.current
      active.current = null
      if (recordingId) void invoke('mic_cancel', { recordingId }).catch(error => reportFault('Stopping the microphone', error))
    }
  }, [conversationId])
  useEffect(() => { setRecording(false); setWaveSource(null) }, [conversationId])

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
        const capture = browser.current; browser.current = null
        let audioBase64: string | undefined
        try { audioBase64 = await capture?.finish() }
        catch (error) { await invoke('mic_cancel', { recordingId }); throw error }
        if (generation.current !== scope) { await invoke('mic_cancel', { recordingId }); return }
        const text = await invoke<string>('mic_transcribe', { recordingId, ...(audioBase64 ? { audioBase64 } : {}) })
        if (generation.current === scope && text.trim()) callback.current(text)
      } else {
        if (!conversationId) throw new Error('Open a conversation before recording.')
        const { recordingId, samplesPerSecond } = await invoke<RecordingStarted>('mic_start', { conversationId })
        if (generation.current !== scope) {
          await invoke('mic_cancel', { recordingId })
          return
        }
        if (!Number.isFinite(samplesPerSecond) || samplesPerSecond <= 0) {
          await invoke('mic_cancel', { recordingId })
          throw new Error('Native recording returned an invalid waveform sample rate.')
        }
        if (/Android|iPhone|iPad/.test(navigator.userAgent)) {
          try {
            const capture = await startBrowserRecording(error => { reportFault('Microphone', error); cancel() })
            if (generation.current !== scope) { capture.cancel(); await invoke('mic_cancel', { recordingId }); return }
            browser.current = capture
          } catch (error) { await invoke('mic_cancel', { recordingId }); throw error }
        }
        active.current = recordingId
        samples.current = []
        setWaveSource(browser.current?.wave ?? { samplesPerSecond, read: () => samples.current.splice(0) })
        setRecording(true)
      }
    } catch (error) { if (generation.current === scope) reportFault('Microphone', error) }
    finally { working.current = false; setTranscribing(false) }
  }, [conversationId, cancel])

  return { recording, transcribing, waveSource, toggleMic, cancel }
}
