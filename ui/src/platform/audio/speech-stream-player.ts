import type { SpeechAlignment } from '../../generated/contracts'
import { claimSpeechPlayer, releaseSpeechPlayer, type PlaybackHandle, type PlaybackObserver } from './speech-player'
import { speechPlaybackPermit } from './speech'
import { speechContext } from './speech-context'
import { createSpeechFollower } from './speech-follow'
import { PCM_RATE, PcmTempo, pcmBytes, wavPcm } from './pcm-tempo'

export interface SpeechStreamPlayer extends PlaybackHandle {
  append: (base64: string, sampleOffset: number, alignment?: SpeechAlignment | null) => number
  finish: (audio: { audioBase64: string; alignment?: SpeechAlignment | null }) => void
}

/** Schedule PCM against the audio clock, not network arrival or animation frames.
 * The 160 ms horizon absorbs ordinary IPC jitter. Underruns wait without advancing
 * the source clock; only validated completion can end playback. [@speech_buffer_schedule] */
export function createSpeechStreamPlayer(onEnd: () => void, onError: (error: unknown) => void, rate = 1, volume = 1, observer?: PlaybackObserver): SpeechStreamPlayer {
  if (!Number.isFinite(rate) || rate < 0.5 || rate > 1.5 || !Number.isFinite(volume) || volume < 0 || volume > 1) throw new Error('Invalid voice playback settings.')
  const context = speechContext()
  const gain = context.createGain()
  gain.gain.value = volume; gain.connect(context.destination)
  const tempo = new PcmTempo()
  const permit = speechPlaybackPermit()
  let released = false; let started = false; let completed = false
  let nextTime = 0; let lastPosition = 0; let audible = false
  let timer: ReturnType<typeof setInterval> | null = null
  let follower: ReturnType<typeof createSpeechFollower> | null = null
  const nodes = new Set<AudioBufferSourceNode>()
  const timeline: { start: number; end: number; from: number; to: number }[] = []
  const reportPlaying = (playing: boolean) => { if (playing !== audible) { audible = playing; observer?.onPlaying?.(playing) } }
  const clearNodes = () => {
    for (const node of nodes) { node.onended = null; node.stop(); node.disconnect() }
    nodes.clear(); timeline.length = 0
  }
  const fail = (error: unknown) => { if (!released) { handle.stop(); onError(error) } }
  const pump = () => {
    if (released || !started) return
    if (!permit || speechPlaybackPermit() !== permit) { handle.suspend(); return }
    try {
      const now = context.currentTime
      while (timeline.length && timeline[0].end <= now) lastPosition = timeline.shift()!.to
      const segment = timeline.find(item => item.start <= now && now < item.end)
      if (segment) lastPosition = segment.from + (segment.to - segment.from) * (now - segment.start) / (segment.end - segment.start)
      const playing = !!segment && context.state === 'running'
      reportPlaying(playing)
      observer?.onTime?.(lastPosition / PCM_RATE, completed ? tempo.length / PCM_RATE : 0)
      if (playing) follower?.update(lastPosition / PCM_RATE, tempo.length / PCM_RATE)
      else follower?.clear()
      if (context.state !== 'running') return
      // A short rebuffer avoids scheduling individual samples as each read arrives.
      if (!timeline.length && !completed && tempo.length - tempo.position < PCM_RATE * 0.1) return
      nextTime = Math.max(nextTime, now + 0.02)
      while (nextTime < now + 0.16) {
        const hop = tempo.next(rate)
        if (!hop) break
        const buffer = context.createBuffer(1, hop.samples.length, PCM_RATE)
        buffer.copyToChannel(hop.samples as Float32Array<ArrayBuffer>, 0)
        const node = context.createBufferSource()
        node.buffer = buffer; node.connect(gain)
        const end = nextTime + hop.samples.length / PCM_RATE
        timeline.push({ start: nextTime, end, from: hop.from, to: hop.to })
        nodes.add(node)
        node.onended = () => { nodes.delete(node); node.disconnect() }
        node.start(nextTime)
        nextTime = end
      }
      if (completed && tempo.position >= tempo.length && !timeline.length) {
        observer?.onTime?.(tempo.length / PCM_RATE, tempo.length / PCM_RATE)
        handle.stop(); onEnd()
      }
    } catch (error) { fail(error) }
  }
  const handle: SpeechStreamPlayer = {
    append: (encoded, offset, alignment) => {
      if (released) return offset
      const bytes = pcmBytes(encoded)
      tempo.append(bytes, offset)
      if (alignment) follower = createSpeechFollower({ text: observer?.sourceText ?? alignment.sourceText, alignment, partial: true, context: observer?.followSource })
      else { follower?.clear(); follower = null }
      pump()
      return offset + bytes.length / 2
    },
    finish: audio => {
      if (released) return
      tempo.finish(wavPcm(audio.audioBase64)); completed = true
      follower = createSpeechFollower({ text: observer?.sourceText ?? audio.alignment?.sourceText ?? '', alignment: audio.alignment, context: observer?.followSource })
      pump()
    },
    play: async () => {
      if (released) return
      if (!permit || speechPlaybackPermit() !== permit) { handle.suspend(); return }
      await context.resume()
      if (released) return
      if (context.state !== 'running') throw new Error('Speech audio device did not start.')
      started = true; pump()
      if (!released && timer === null) timer = setInterval(pump, 20)
    },
    stop: () => {
      if (released) return
      released = true; started = false
      if (timer !== null) clearInterval(timer)
      clearNodes(); gain.disconnect(); follower?.clear()
      reportPlaying(false); observer?.onReady?.(null)
      releaseSpeechPlayer(handle)
    },
    suspend: () => { if (!released) { handle.stop(); onEnd() } },
    seek: seconds => {
      if (released || !completed || !Number.isFinite(seconds)) return
      clearNodes(); tempo.seek(seconds * PCM_RATE); lastPosition = tempo.position
      nextTime = 0; follower?.clear(); pump()
    },
    setRate: value => {
      if (!Number.isFinite(value) || value < 0.5 || value > 1.5) throw new Error('Invalid voice playback speed.')
      rate = value
    },
    setVolume: value => {
      if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('Invalid voice playback volume.')
      if (!released) gain.gain.value = value
    },
  }
  claimSpeechPlayer(handle)
  if (!released) observer?.onReady?.(handle)
  return handle
}
