// Runs on the audio thread. Capture PCM directly; no compressed recording needs
// to be decoded after Stop, avoiding WebKit's MediaRecorder decode failure.
declare class AudioWorkletProcessor {
  readonly port: MessagePort
}
declare function registerProcessor(name: string, processor: typeof AudioWorkletProcessor): void

class RecordingProcessor extends AudioWorkletProcessor {
  private samples = new Float32Array(2048)
  private length = 0
  private finished = false

  constructor() {
    super()
    this.port.onmessage = event => {
      if (event.data !== 'finish' || this.finished) return
      this.finished = true
      this.flush()
      this.port.postMessage('finished')
    }
  }

  private flush() {
    if (this.length === 0) return
    const chunk = this.samples.slice(0, this.length)
    this.port.postMessage(chunk, [chunk.buffer])
    this.length = 0
  }

  process(inputs: Float32Array[][]): boolean {
    if (this.finished) return false
    const channels = inputs[0]
    if (!channels?.length) return true
    for (let i = 0; i < channels[0].length; i++) {
      let sample = 0
      for (const channel of channels) sample += channel[i]
      this.samples[this.length++] = sample / channels.length
      if (this.length === this.samples.length) this.flush()
    }
    return true
  }
}
registerProcessor('skellyspeak-recording', RecordingProcessor)
export {}
