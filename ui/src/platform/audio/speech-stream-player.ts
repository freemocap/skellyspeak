import type { SpeechAlignment } from '../../generated/contracts'
import { claimSpeechPlayer, releaseSpeechPlayer, type PlaybackHandle, type PlaybackObserver } from './speech-player'
import { speechPlaybackPermit } from './speech'
import { speechContext } from './speech-context'
import { createSpeechFollower } from './speech-follow'
import { PCM_RATE, PcmTempo, pcmBytes, wavPcm } from './pcm-tempo'
import { estimatedTotalSpeechSeconds, speechWords } from '../../domain/audio/speech-follow'

export interface SpeechStreamPlayer extends PlaybackHandle {
  append: (base64: string, sampleOffset: number, alignment?: SpeechAlignment | null) => number
  finish: (audio: { audioBase64: string; alignment?: SpeechAlignment | null }) => void
}

const MIN_RATE_WINDOW_MS = 250
const MIN_BUFFER_SECONDS = 0.75
const MAX_BUFFER_SECONDS = 3
const MIN_DELIVERY_MARGIN = 1.15
const SCHEDULE_AHEAD_SECONDS = 0.75

/** Schedule PCM against the audio clock, not network arrival or animation frames.
 * Observe delivery before starting: a stream slower than playback cannot be made
 * continuous by a small fixed buffer when its eventual length is unknown. */
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
  let firstChunkAt: number | null = null; let firstChunkSamples = 0; let lastChunkAt = 0; let largestArrivalGapMs = 0; let arrivals = 0
  let playbackBegun = false; let recovering = false
  let estimatedTotalSeconds: number | null = null
  let alignedThroughSeconds = 0
  const nodes = new Set<AudioBufferSourceNode>()
  const timeline: { start: number; end: number; from: number; to: number }[] = []
  const reportPlaying = (playing: boolean) => { if (playing !== audible) { audible = playing; observer?.onPlaying?.(playing) } }
  const clearNodes = () => {
    for (const node of nodes) { node.onended = null; node.stop(); node.disconnect() }
    nodes.clear(); timeline.length = 0
  }
  const fail = (error: unknown) => { if (!released) { handle.stop(); onError(error) } }
  const canSchedule = () => {
    if (completed) return true
    const playableEnd = completed ? tempo.length / PCM_RATE : Math.min(tempo.length / PCM_RATE, alignedThroughSeconds)
    const remaining = playableEnd - tempo.position / PCM_RATE
    if (recovering) return false
    if (playbackBegun) {
      if (timeline.length || remaining >= 0.1 * rate) return true
      if ((tempo.length - tempo.position) / PCM_RATE >= 0.1 * rate) return false
      recovering = true
    }
    if (firstChunkAt === null) return false
    const elapsed = performance.now() - firstChunkAt
    if (arrivals < 2 || elapsed < MIN_RATE_WINDOW_MS) return false
    const deliveryRate = (tempo.length - firstChunkSamples) / PCM_RATE / (elapsed / 1000)
    const safety = Math.min(MAX_BUFFER_SECONDS, Math.max(MIN_BUFFER_SECONDS, largestArrivalGapMs / 500 + 0.3)) * rate
    let target = safety
    if (deliveryRate < rate) {
      // Given estimated total source audio L, current delivery R, source arrival
      // rate d and playback rate p, the future deficit is (L - R) * (p/d - 1).
      // Without a credible duration or arrival rate, completion is the safe bound.
      if (estimatedTotalSeconds === null || deliveryRate <= 0) return false
      target += Math.max(0, estimatedTotalSeconds - tempo.length / PCM_RATE) * (rate / deliveryRate - 1)
    } else if (deliveryRate < rate * MIN_DELIVERY_MARGIN) {
      target += safety / 2
    }
    if (remaining < target) return false
    recovering = false
    playbackBegun = true
    return true
  }
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
      if (!canSchedule()) return
      nextTime = Math.max(nextTime, now + 0.02)
      while (nextTime < now + SCHEDULE_AHEAD_SECONDS) {
        if (!completed && tempo.position / PCM_RATE + 0.02 * rate > alignedThroughSeconds) break
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
      const arrivedAt = performance.now()
      if (firstChunkAt === null) { firstChunkAt = arrivedAt; firstChunkSamples = tempo.length }
      else largestArrivalGapMs = Math.max(largestArrivalGapMs, arrivedAt - lastChunkAt)
      lastChunkAt = arrivedAt
      arrivals++
      if (alignment) {
        const sourceText = observer?.sourceText ?? alignment.sourceText
        const words = speechWords(sourceText, alignment, true)
        if (words.length) {
          alignedThroughSeconds = Math.max(alignedThroughSeconds, words.at(-1)!.to)
          estimatedTotalSeconds = estimatedTotalSpeechSeconds(sourceText, alignment, tempo.length / PCM_RATE, words)
          follower = createSpeechFollower({ text: sourceText, alignment, words, partial: true, context: observer?.followSource })
        }
      }
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
