import type { SpeechAudioState } from '../../contracts'
import { registerSpeechPlayback } from '../../platform/audio/speech'

/** Playback only: this module cannot request speech generation. */
interface PlaybackHandle {
  stop: () => void
  play: () => Promise<void>
  suspend: () => void
  setVolume: (volume: number) => void
}

let current: PlaybackHandle | null = null

/// Only the player that still owns the registration may clear it: a newer
/// utterance must survive an older one releasing late.
function release(handle: PlaybackHandle): void {
  if (current !== handle) return
  current = null
  registerSpeechPlayback(null)
}

export function playSpeechAudio(state: Extract<SpeechAudioState, { status: 'ready' }>, onEnd: () => void, onError: () => void, rate = 1, volume = 1): PlaybackHandle {
  if (!Number.isFinite(rate) || rate < 0.5 || rate > 1.5 || !Number.isFinite(volume) || volume < 0 || volume > 1) throw new Error('Invalid voice playback settings.')
  const bytes = Uint8Array.from(atob(state.audioBase64), char => char.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: state.mime }))
  const audio = new Audio(url)
  audio.playbackRate = rate; audio.preservesPitch = true; audio.volume = volume
  let released = false
  const handle: PlaybackHandle = {
    stop: () => {
      if (released) return
      released = true
      audio.onended = null; audio.onerror = null
      audio.pause(); audio.removeAttribute('src'); audio.load()
      URL.revokeObjectURL(url)
      release(handle)
    },
    play: () => audio.play(),
    /// Suspension is an end, not a pause: the caller clears its speaking state.
    suspend: () => { if (released) return; handle.stop(); onEnd() },
    setVolume: (value: number) => { if (!released) audio.volume = value },
  }
  audio.onended = () => { handle.stop(); onEnd() }
  audio.onerror = () => { handle.stop(); onError() }
  current = handle
  registerSpeechPlayback(handle)
  return handle
}
