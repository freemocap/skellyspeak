import { createSpeechStreamPlayer, type SpeechStreamPlayer } from '../src/platform/audio/speech-stream-player'
import { interruptSpeech, setPlaybackAllowed } from '../src/platform/audio/speech'
import { unlockSpeechAudio } from '../src/platform/audio/speech-context'

const result = document.querySelector<HTMLPreElement>('#result')!
const rate = document.querySelector<HTMLSelectElement>('#rate')!
const audible = document.querySelector<HTMLInputElement>('#audible')!
let player: SpeechStreamPlayer | null = null
let scope = 0
let startedAt = 0
let firstPlaying: number | null = null
let completedAt: number | null = null
let waits = 0
let sourceTime = 0
let finished = false
let error: string | null = null
const elapsed = () => Math.round(performance.now() - startedAt)
const show = () => { result.textContent = JSON.stringify({ firstPlayingMs: firstPlaying, completionReceivedMs: completedAt, playedBeforeCompletion: firstPlaying !== null && (completedAt === null || firstPlaying < completedAt), bufferingTransitions: waits, sourceSeconds: +sourceTime.toFixed(3), finished, error }, null, 2) }
const encode = (bytes: Uint8Array) => { let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary) }
const bytes = new Uint8Array(24000 * 2 * 2)
const data = new DataView(bytes.buffer)
for (let sample = 0; sample < bytes.length / 2; sample++) {
  const t = sample / 24000
  const envelope = Math.min(1, t * 40, (2 - t) * 40)
  data.setInt16(sample * 2, Math.round(6000 * envelope * Math.sin(t * 2 * Math.PI * 220)), true)
}
const wav = new Uint8Array(44 + bytes.length)
const view = new DataView(wav.buffer)
const tag = (offset: number, value: string) => [...value].forEach((c, i) => { wav[offset + i] = c.charCodeAt(0) })
tag(0, 'RIFF'); tag(8, 'WAVE'); tag(12, 'fmt '); tag(36, 'data')
view.setUint32(4, wav.length - 8, true); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
view.setUint32(24, 24000, true); view.setUint32(28, 48000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); view.setUint32(40, bytes.length, true); wav.set(bytes, 44)

document.querySelector('#start')!.addEventListener('click', () => {
  player?.stop(); interruptSpeech(); setPlaybackAllowed(true); unlockSpeechAudio()
  const generation = ++scope
  startedAt = performance.now(); firstPlaying = null; completedAt = null; waits = 0; sourceTime = 0; finished = false; error = null
  const failed = (cause: unknown) => { if (scope === generation) { error = String(cause); player?.stop(); show() } }
  player = createSpeechStreamPlayer(() => { if (scope === generation) { finished = true; show() } }, failed, +rate.value, audible.checked ? 0.15 : 0, {
    onPlaying: playing => { if (playing) firstPlaying ??= elapsed(); else waits++; show() },
    onTime: seconds => { sourceTime = seconds; show() },
  })
  void player.play().catch(failed)
  const deliver = (delay: number, callback: () => void) => setTimeout(() => { if (scope === generation) { try { callback() } catch (cause) { failed(cause) } } }, delay)
  deliver(150, () => { player!.append(encode(bytes.subarray(0, 24000)), 0) })
  deliver(950, () => { player!.append(encode(bytes.subarray(24000, 48000)), 12000) })
  deliver(1150, () => { player!.append(encode(bytes.subarray(48000)), 24000) })
  deliver(1700, () => { completedAt = elapsed(); player!.finish({ audioBase64: encode(wav), alignment: null }); show() })
  show()
})
document.querySelector('#stop')!.addEventListener('click', () => { scope++; player?.stop(); player = null; result.textContent = 'Stopped; late chunks are ignored.' })
rate.addEventListener('change', () => player?.setRate(+rate.value))
window.addEventListener('pagehide', () => { scope++; player?.stop() })
