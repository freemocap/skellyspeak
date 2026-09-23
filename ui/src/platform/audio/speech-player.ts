import { mediaError } from './media-error'
import type { SpeechAudioState } from '../../generated/contracts'
import { registerSpeechPlayback, speechPlaybackPermit } from './speech'

/** Playback only: this module cannot request speech generation. */
export interface PlaybackHandle {
  seek: (seconds: number) => void
  stop: () => void
  play: () => Promise<void>
  suspend: () => void
  setVolume: (volume: number) => void
}

export interface PlaybackObserver { onTime?: (seconds: number, duration: number) => void; onReady?: (player: PlaybackHandle | null) => void; startSeconds?: number }

let current: PlaybackHandle | null = null

/// Only the player that still owns the registration may clear it: a newer
/// utterance must survive an older one releasing late.
function release(handle: PlaybackHandle): void {
  if (current !== handle) return
  current = null
  registerSpeechPlayback(null)
}

export function playSpeechAudio(state: Extract<SpeechAudioState, { status: 'ready' }>, onEnd: () => void, onError: (error: Error) => void, rate = 1, volume = 1, observer?: PlaybackObserver): PlaybackHandle {
  if (!Number.isFinite(rate) || rate < 0.5 || rate > 1.5 || !Number.isFinite(volume) || volume < 0 || volume > 1) throw new Error('Invalid voice playback settings.')
  const bytes = Uint8Array.from(atob(state.audioBase64), char => char.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: state.mime }))
  const audio = new Audio(url)
  audio.playbackRate = rate; audio.preservesPitch = true; audio.volume = volume
  let released = false
  let frame: number | null = null
  const tick = () => { if (released) return; observer?.onTime?.(audio.currentTime, Number.isFinite(audio.duration) ? audio.duration : 0); frame = requestAnimationFrame(tick) }
  const handle: PlaybackHandle = {
    seek: seconds => { if (!released && Number.isFinite(seconds) && Number.isFinite(audio.duration)) audio.currentTime = Math.max(0, Math.min(audio.duration, seconds)) },
    stop: () => {
      if (released) return
      released = true
      if (frame !== null) cancelAnimationFrame(frame)
      observer?.onReady?.(null)
      audio.onloadedmetadata = null
      audio.onended = null; audio.onerror = null
      audio.pause(); audio.removeAttribute('src'); audio.load()
      URL.revokeObjectURL(url)
      release(handle)
    },
    play: async () => {
      if (released) return
      if (!speechPlaybackPermit()) { handle.suspend(); return }
      try { await audio.play() } catch (error) {
        // pause/load may reject an outstanding play promise during suspension.
        // That utterance already ended; genuine playback failures still reject.
        if (!released) throw error
      }
    },
    /// Suspension is an end, not a pause: the caller clears its speaking state.
    suspend: () => { if (released) return; handle.stop(); onEnd() },
    setVolume: (value: number) => { if (!released) audio.volume = value },
  }
  audio.onloadedmetadata = () => { if (observer?.startSeconds) handle.seek(observer.startSeconds) }
  audio.onended = () => { observer?.onTime?.(audio.currentTime, audio.duration); handle.stop(); onEnd() }
  audio.onerror = () => { const error = mediaError(audio.error, 'Speech playback'); handle.stop(); onError(error) }
  current?.suspend()
  current = handle
  registerSpeechPlayback(handle)
  if (!released) { observer?.onReady?.(handle); if (observer?.onTime) frame = requestAnimationFrame(tick) }
  return handle
}
