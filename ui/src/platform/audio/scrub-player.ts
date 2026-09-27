import workletUrl from './scrub-worklet.ts?worker&url'
import type { ScrubCommand } from './scrub-worklet'
import { interruptSpeech, registerSpeechPlayback, speechPlaybackPermit } from './speech'
import { mediaError } from './media-error'

/** Decode once; the audio thread owns the only read head and output stream. */
export function createScrubPlayer(audio: string, onError: (error: unknown) => void) {
  let context: AudioContext | null = null
  let node: AudioWorkletNode | null = null
  let output: GainNode | null = null
  let preparation: Promise<void> | null = null
  let disposed = false, active = false, registered = false
  let position = 0, timestamp = 0, volume = 1
  let permit: object | null = null
  const send = (command: ScrubCommand) => node?.port.postMessage(command)
  const end = () => {
    active = false
    send({ type: 'stop' })
    if (output) output.gain.value = 0
    if (registered) { registered = false; registerSpeechPlayback(null) }
    permit = null
  }
  const fail = (error: unknown) => { end(); onError(mediaError(error, 'Scrub playback')) }
  const setVolume = (value: number) => {
    volume = value
    if (output && active) output.gain.value = value
  }
  const authority = { suspend: end, setVolume }
  const prepare = () => {
    context ??= new AudioContext({ latencyHint: 'interactive' })
    const current = context
    // Resume during pointer activation; loading never starts playback itself.
    void current.resume().catch(error => { if (!disposed) fail(error) })
    preparation ??= (async () => {
      const bytes = Uint8Array.from(atob(audio), value => value.charCodeAt(0))
      const [buffer] = await Promise.all([
        current.decodeAudioData(bytes.buffer), current.audioWorklet.addModule(workletUrl),
      ])
      if (disposed) return
      node = new AudioWorkletNode(current, 'skellyspeak-scrub', {
        numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [buffer.numberOfChannels],
      })
      node.onprocessorerror = () => fail(new Error('Scrub sample processing failed.'))
      output = current.createGain(); output.gain.value = active ? volume : 0
      node.connect(output); output.connect(current.destination)
      const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i).slice())
      const message: ScrubCommand = { type: 'load', sourceRate: buffer.sampleRate, channels }
      node.port.postMessage(message, channels.map(channel => channel.buffer))
      // Anchor at the latest position. Never replay movement accumulated while loading.
      if (active && speechPlaybackPermit() === permit) send({ type: 'start', seconds: position })
    })().catch(error => { preparation = null; if (!disposed) fail(error) })
  }
  return {
    start: (seconds: number, stamp = performance.now()) => {
      end()
      if (disposed || !Number.isFinite(seconds)) return
      permit = interruptSpeech()
      if (!permit) return
      position = seconds; timestamp = stamp
      active = true; registered = true; registerSpeechPlayback(authority)
      try {
        prepare()
        if (output) output.gain.value = volume
        send({ type: 'start', seconds })
      } catch (error) { fail(error) }
    },
    move: (seconds: number, stamp = performance.now()) => {
      if (!active || disposed || !Number.isFinite(seconds) || !Number.isFinite(stamp)) return
      if (speechPlaybackPermit() !== permit) { end(); return }
      if (position === seconds) return
      const elapsed = Math.max(0, (stamp - timestamp) / 1000)
      position = seconds; timestamp = stamp
      send({ type: 'move', seconds, elapsed })
    },
    end, setVolume,
    dispose: () => {
      disposed = true; end()
      if (node) { node.onprocessorerror = null; node.port.close(); node.disconnect(); node = null }
      output?.disconnect(); output = null
      if (context) void context.close().catch(onError)
      context = null
    },
  }
}
