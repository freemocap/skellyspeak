import type { SpeechAudioState } from '../../contracts'

/** Playback only: this module cannot request speech generation. */
export function playSpeechAudio(state: Extract<SpeechAudioState, { status: 'ready' }>, onEnd: () => void, onError: () => void) {
  const bytes = Uint8Array.from(atob(state.audioBase64), char => char.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: state.mime }))
  const audio = new Audio(url)
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
