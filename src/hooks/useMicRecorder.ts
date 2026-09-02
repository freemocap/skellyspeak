import { useCallback, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { logDebug, logError, logInfo, logWarn } from '../lib/log'

const MIC_SILENCE_STOP_MS = 20_000
const MIC_VOICE_THRESHOLD = 0.02

interface MicRecorderOptions {
  micDeviceId: string | null | undefined
  onTranscribe: (text: string) => void
  /// Context hint passed to Whisper (live vocabulary, recent conversation).
  buildPrompt: () => string
}

interface MicRecorder {
  recording: boolean
  recAnalyser: AnalyserNode | null
  toggleMic: () => void
  cancel: () => void
}

/// Microphone recording lifecycle: permission, capture, silence auto-stop,
/// live waveform analyser, and Whisper transcription. `onTranscript` fires
/// with the transcript when a recording completes.
export function useMicRecorder({ micDeviceId, onTranscribe, buildPrompt }: MicRecorderOptions): MicRecorder {
  const [recording, setRecording] = useState(false)
  const [recAnalyser, setRecAnalyser] = useState<AnalyserNode | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const abortRef = useRef(false)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const silencePollRef = useRef<number | null>(null)
  const onTranscribeRef = useRef(onTranscribe)
  onTranscribeRef.current = onTranscribe
  const buildPromptRef = useRef(buildPrompt)
  buildPromptRef.current = buildPrompt
  const micDeviceIdRef = useRef(micDeviceId)
  micDeviceIdRef.current = micDeviceId

  const toggleMic = useCallback(async () => {
    if (recorderRef.current) {
      logInfo('[mic] stop requested by user')
      recorderRef.current.stop()
      return
    }
    try {
      const constraints: MediaTrackConstraints = {}
      const deviceId = micDeviceIdRef.current
      if (deviceId) {
        constraints.deviceId = { exact: deviceId }
      }
      logInfo('[mic] requesting permission…', { deviceId: deviceId ?? '(default)' })
      const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints })
      const track = stream.getAudioTracks()[0]
      logInfo('[mic] permission granted, device:', track.label)
      setRecording(true)
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => {
        logDebug('[mic] chunk:', e.data.size, 'bytes')
        chunks.push(e.data)
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        if (abortRef.current) {
          abortRef.current = false
          recorderRef.current = null
          setRecording(false)
          setRecAnalyser(null)
          if (silencePollRef.current !== null) {
            window.clearInterval(silencePollRef.current)
            silencePollRef.current = null
          }
          void audioCtxRef.current?.close()
          audioCtxRef.current = null
          logInfo('[mic] recording cancelled')
          return
        }
        recorderRef.current = null
        setRecording(false)
        setRecAnalyser(null)
        if (silencePollRef.current !== null) {
          window.clearInterval(silencePollRef.current)
          silencePollRef.current = null
        }
        void audioCtxRef.current?.close()
        audioCtxRef.current = null
        const blob = new Blob(chunks, { type: recorder.mimeType })
        logInfo('[mic] recording finished:', blob.size, 'bytes,', recorder.mimeType)
        const buffer = await blob.arrayBuffer()
        try {
          const probe = new AudioContext()
          const decoded = await probe.decodeAudioData(buffer.slice(0))
          let peak = 0
          for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
            const data = decoded.getChannelData(ch)
            for (let i = 0; i < data.length; i++) {
              const a = Math.abs(data[i])
              if (a > peak) peak = a
            }
          }
          void probe.close()
          logDebug(
            '[mic] peak amplitude:', peak.toFixed(4),
            peak < 0.01 ? '=> SILENCE (host audio not reaching emulator)' : '=> real audio captured'
          )
        } catch (e) {
          logWarn('[mic] amplitude probe failed:', e)
        }
        let binary = ''
        const bytes = new Uint8Array(buffer)
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
        try {
          const text = await invoke<string>('transcribe_audio', {
            audioBase64: btoa(binary),
            prompt: buildPromptRef.current(),
          })
          logInfo('[mic] transcribed:', text)
          if (text) onTranscribeRef.current(text)
          else logWarn('[mic] transcription was empty (silence?)')
        } catch (e) {
          logError('[mic] transcription failed:', e)
          onTranscribeRef.current('')
        }
      }
      recorder.start()
      logInfo('[mic] recording started (tap again to stop; auto-stops after 20s of silence)')

      // Silence auto-stop: reset a 20s timer whenever the mic picks up voice;
      // stop when the timer expires. The same analyser feeds the waveform.
      try {
        const ctx = new AudioContext()
        void ctx.resume()
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 2048
        source.connect(analyser)
        const buf = new Float32Array(analyser.fftSize)
        audioCtxRef.current = ctx
        setRecAnalyser(analyser)
        let lastVoiceAt = Date.now()
        silencePollRef.current = window.setInterval(() => {
          analyser.getFloatTimeDomainData(buf)
          let peak = 0
          for (let i = 0; i < buf.length; i++) {
            const a = Math.abs(buf[i])
            if (a > peak) peak = a
          }
          const now = Date.now()
          if (peak >= MIC_VOICE_THRESHOLD) {
            lastVoiceAt = now
          } else if (
            recorder.state !== 'inactive' &&
            now - lastVoiceAt >= MIC_SILENCE_STOP_MS
          ) {
            logInfo('[mic] silence auto-stop (20s without voice)')
            recorder.stop()
          }
        }, 500)
      } catch (e) {
        logWarn('[mic] silence detection unavailable — manual stop only:', e)
      }
    } catch (e) {
      setRecording(false)
      logError('[mic] failed to start recording:', e)
    }
  }, [])

  // Abort without transcribing — teardown only, no side effects.
  const cancel = useCallback(() => {
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') {
      // onstop runs, but we clear the chunks via a flag so nothing is sent.
      abortRef.current = true
      rec.stop()
    }
    if (silencePollRef.current !== null) {
      window.clearInterval(silencePollRef.current)
      silencePollRef.current = null
    }
    void audioCtxRef.current?.close()
    audioCtxRef.current = null
    setRecAnalyser(null)
    setRecording(false)
  }, [])

  return { recording, recAnalyser, toggleMic, cancel }
}
