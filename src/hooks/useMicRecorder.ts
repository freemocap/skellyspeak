import { useCallback, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { logDebug, logInfo } from '../lib/log'
import { reportFault } from '../lib/faults'
import { mediaDevices } from '../lib/media'
import type { WaveSource } from '../components/WaveformStrip'

const MIC_SILENCE_STOP_MS = 20_000
const MIC_VOICE_THRESHOLD = 0.02

/// How often the core is asked for the waveform it has captured. Fast enough
/// that the strip scrolls smoothly, slow enough that it is 10 IPC calls a
/// second rather than 60.
const NATIVE_POLL_MS = 100

interface MicRecorderOptions {
  micDeviceId: string | null | undefined
  onTranscribe: (text: string) => void
  /// Context hint passed to Whisper (live vocabulary, recent conversation).
  buildPrompt: () => string
}

interface MicRecorder {
  recording: boolean
  waveSource: WaveSource | null
  toggleMic: () => void
  cancel: () => void
}

/// Microphone recording lifecycle: permission, capture, silence auto-stop,
/// live waveform, and Whisper transcription. `onTranscribe` fires with the
/// transcript when a recording completes.
///
/// There are two recorders behind this, chosen by where the audio can actually
/// come from — `mic_native` in the core decides, and it is a compile-time fact
/// there rather than a probe here:
///
/// - **Desktop** records in the core with cpal. A packaged macOS build has no
///   `navigator.mediaDevices` at all (WKWebView will not treat Tauri's custom
///   scheme as a secure context), so the browser recorder is not an option
///   there, and putting the other desktops on a different recorder would mean
///   two paths to keep honest instead of one.
/// - **Mobile** records in the webview, where the browser API is present and
///   the OS owns the permission prompt.
///
/// Neither is a fallback for the other: if the chosen recorder fails, the
/// failure is reported and nothing else is tried.
export function useMicRecorder({ micDeviceId, onTranscribe, buildPrompt }: MicRecorderOptions): MicRecorder {
  const [recording, setRecording] = useState(false)
  const [waveSource, setWaveSource] = useState<WaveSource | null>(null)

  /// Ends the recording in progress. Null when nothing is running, which is
  /// also how `toggleMic` knows which way it is toggling.
  const stopRef = useRef<((abort: boolean) => void) | null>(null)

  const onTranscribeRef = useRef(onTranscribe)
  onTranscribeRef.current = onTranscribe
  const buildPromptRef = useRef(buildPrompt)
  buildPromptRef.current = buildPrompt
  const micDeviceIdRef = useRef(micDeviceId)
  micDeviceIdRef.current = micDeviceId

  /// Hand a finished recording to Whisper. Shared by both recorders — by this
  /// point it is base64 audio and nothing downstream cares which one made it.
  const transcribe = useCallback(async (audioBase64: string) => {
    try {
      const text = await invoke<string>('transcribe_audio', {
        audioBase64,
        prompt: buildPromptRef.current(),
      })
      logInfo('[mic] transcribed:', text)
      // An empty transcription is the normal outcome of a silent recording,
      // not a failure — the composer simply stays as it was.
      if (text) onTranscribeRef.current(text)
      else logInfo('[mic] transcription was empty (silence)')
    } catch (e) {
      reportFault('Transcription', e)
      onTranscribeRef.current('')
    }
  }, [])

  // ── Desktop: the core records ────────────────────────────────────────────

  const startNative = useCallback(async () => {
    const device = micDeviceIdRef.current || null
    logInfo('[mic] starting core capture', { device: device ?? '(system default)' })
    const samplesPerSecond = await invoke<number>('mic_start', { device })
    setRecording(true)

    // Drained by the waveform every frame, refilled by the poll below.
    let pending: number[] = []
    let lastVoiceAt = Date.now()
    let polling = false

    const poll = window.setInterval(() => {
      // A slow round trip must not stack more calls up behind it.
      if (polling) return
      polling = true
      void invoke<number[]>('mic_wave')
        .then((chunk) => {
          if (chunk.length > 0) {
            pending = pending.concat(chunk)
            let peak = 0
            for (const v of chunk) {
              const a = Math.abs(v)
              if (a > peak) peak = a
            }
            if (peak >= MIC_VOICE_THRESHOLD) lastVoiceAt = Date.now()
          }
          if (Date.now() - lastVoiceAt >= MIC_SILENCE_STOP_MS) {
            logInfo('[mic] silence auto-stop (20s without voice)')
            stopRef.current?.(false)
          }
        })
        .catch((e: unknown) => reportFault('Microphone level meter', e))
        .finally(() => {
          polling = false
        })
    }, NATIVE_POLL_MS)

    setWaveSource({ samplesPerSecond, read: () => pending.splice(0) })

    stopRef.current = (abort: boolean) => {
      stopRef.current = null
      window.clearInterval(poll)
      setRecording(false)
      setWaveSource(null)
      if (abort) {
        invoke('mic_cancel').catch((e: unknown) => reportFault('Stopping the microphone', e))
        logInfo('[mic] recording cancelled')
        return
      }
      void invoke<string>('mic_stop')
        .then((audioBase64) => {
          logDebug('[mic] core capture finished:', audioBase64.length, 'base64 chars')
          return transcribe(audioBase64)
        })
        .catch((e: unknown) => reportFault('Microphone', e))
    }
  }, [transcribe])

  // ── Mobile: the webview records ──────────────────────────────────────────

  const startBrowser = useCallback(async () => {
    const constraints: MediaTrackConstraints = {}
    const deviceId = micDeviceIdRef.current
    if (deviceId) constraints.deviceId = { exact: deviceId }
    logInfo('[mic] requesting permission…', { deviceId: deviceId ?? '(default)' })
    const stream = await mediaDevices().getUserMedia({ audio: constraints })
    logInfo('[mic] permission granted, device:', stream.getAudioTracks()[0]?.label)
    setRecording(true)

    const recorder = new MediaRecorder(stream)
    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => chunks.push(e.data)

    const ctx = new AudioContext()
    void ctx.resume()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    ctx.createMediaStreamSource(stream).connect(analyser)
    const frame = new Float32Array(analyser.fftSize)
    // One in ten of the time-domain buffer, read once a frame: about the same
    // level of detail the core's decimated stream provides.
    const stride = 10
    setWaveSource({
      samplesPerSecond: (60 * analyser.fftSize) / stride,
      read: () => {
        analyser.getFloatTimeDomainData(frame)
        const out: number[] = []
        for (let i = 0; i < frame.length; i += stride) out.push(frame[i] ?? 0)
        return out
      },
    })

    let lastVoiceAt = Date.now()
    const poll = window.setInterval(() => {
      analyser.getFloatTimeDomainData(frame)
      let peak = 0
      for (let i = 0; i < frame.length; i++) {
        const a = Math.abs(frame[i])
        if (a > peak) peak = a
      }
      if (peak >= MIC_VOICE_THRESHOLD) {
        lastVoiceAt = Date.now()
      } else if (Date.now() - lastVoiceAt >= MIC_SILENCE_STOP_MS) {
        logInfo('[mic] silence auto-stop (20s without voice)')
        stopRef.current?.(false)
      }
    }, 500)

    const teardown = () => {
      window.clearInterval(poll)
      stream.getTracks().forEach((t) => t.stop())
      void ctx.close()
      setRecording(false)
      setWaveSource(null)
    }

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder.mimeType })
      logInfo('[mic] recording finished:', blob.size, 'bytes,', recorder.mimeType)
      void blob
        .arrayBuffer()
        .then((buffer) => {
          const bytes = new Uint8Array(buffer)
          let binary = ''
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
          return transcribe(btoa(binary))
        })
        .catch((e: unknown) => reportFault('Microphone', e))
    }

    stopRef.current = (abort: boolean) => {
      stopRef.current = null
      // Dropping onstop is what makes an abort produce no transcription, rather
      // than a flag the handler has to remember to check.
      if (abort) recorder.onstop = null
      teardown()
      if (recorder.state !== 'inactive') recorder.stop()
      if (abort) logInfo('[mic] recording cancelled')
    }

    recorder.start()
    logInfo('[mic] recording started (tap again to stop; auto-stops after 20s of silence)')
  }, [transcribe])

  const toggleMic = useCallback(async () => {
    if (stopRef.current) {
      logInfo('[mic] stop requested by user')
      stopRef.current(false)
      return
    }
    try {
      if (await invoke<boolean>('mic_native')) await startNative()
      else await startBrowser()
    } catch (e) {
      setRecording(false)
      setWaveSource(null)
      stopRef.current = null
      reportFault('Microphone', e)
    }
  }, [startNative, startBrowser])

  /// Abort without transcribing — teardown only, no side effects.
  const cancel = useCallback(() => {
    stopRef.current?.(true)
  }, [])

  return { recording, waveSource, toggleMic, cancel }
}
