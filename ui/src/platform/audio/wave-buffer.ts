import type { WaveSource } from '../../domain/audio/waveform'

/** Bounded display history from the capture clock, independent of repaint rate. */
export class WaveBuffer implements WaveSource {
  readonly samplesPerSecond: number
  private pending: number[] = []
  private count = 0
  private peak = 0
  private emitted = 0
  private readonly stride = 64

  constructor(sampleRate: number) { this.samplesPerSecond = sampleRate / this.stride }

  append(samples: Float32Array) {
    for (const sample of samples) {
      if (Math.abs(sample) > Math.abs(this.peak)) this.peak = sample
      if (++this.count === this.stride) {
        this.pending.push(this.peak)
        this.emitted++
        this.count = 0
        this.peak = 0
      }
    }
    // Only visual history is evicted; capture/transcription receives all PCM.
    const limit = Math.ceil(this.samplesPerSecond * 12)
    if (this.pending.length > limit) this.pending = this.pending.slice(-limit)
  }

  read = () => this.pending.splice(0)
  endSeconds = () => this.emitted / this.samplesPerSecond
}
