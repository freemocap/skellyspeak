import type { SpeechAudioState } from '../../contracts'

/** Playback only: this module cannot request speech generation. */
export function playSpeechAudio(state: Extract<SpeechAudioState, { status: 'ready' }>, onEnd: () => void, onError: () => void, rate = 1, volume = 1) {
  if (!Number.isFinite(rate) || rate < 0.5 || rate > 1.5 || !Number.isFinite(volume) || volume < 0 || volume > 1) throw new Error('Invalid voice playback settings.')
  const bytes = Uint8Array.from(atob(state.audioBase64), char => char.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: state.mime }))
  const audio = new Audio(url)
  audio.playbackRate = rate; audio.preservesPitch = true; audio.volume = volume
  let released = false
  const stop = () => {
    if (released) return
    released = true
    audio.onended = null; audio.onerror = null
    audio.pause(); audio.removeAttribute('src'); audio.load()
    URL.revokeObjectURL(url)
  }
  audio.onended = () => { stop(); onEnd() }
  audio.onerror = () => { stop(); onError() }
  return { stop, play: () => audio.play() }
}
