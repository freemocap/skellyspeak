import { ScrubReader } from '../../domain/audio/scrub-reader'

declare const sampleRate: number
declare class AudioWorkletProcessor { readonly port: MessagePort }
declare function registerProcessor(name: string, processor: typeof AudioWorkletProcessor): void

export type ScrubCommand =
  | { type: 'load'; channels: Float32Array[]; sourceRate: number }
  | { type: 'start'; seconds: number }
  | { type: 'move'; seconds: number; elapsed: number }
  | { type: 'stop' }

class ScrubProcessor extends AudioWorkletProcessor {
  private reader: ScrubReader | null = null
  constructor() {
    super()
    this.port.onmessage = (event: MessageEvent<ScrubCommand>) => {
      const message = event.data
      switch (message.type) {
        case 'load': this.reader = new ScrubReader(message.channels, message.sourceRate, sampleRate); break
        case 'start': this.reader?.start(message.seconds); break
        case 'move': this.reader?.move(message.seconds, message.elapsed); break
        case 'stop': this.reader?.stop(); break
      }
    }
  }
  process(_inputs: Float32Array[][], outputs: Float32Array[][]) {
    if (outputs[0]) this.reader?.render(outputs[0])
    return true
  }
}
registerProcessor('skellyspeak-scrub', ScrubProcessor)
