/** A single PCM read head. Forward destinations never rewind or overlap audio. */
export class ScrubReader {
  position = 0
  private target = 0
  private remaining = 0
  private step = 0
  private gain = 0
  private active = false
  constructor(private channels: Float32Array[], private sourceRate: number, private outputRate: number) {}
  private frame(seconds: number) {
    return Math.max(0, Math.min(this.channels[0]?.length ?? 0, seconds * this.sourceRate))
  }
  start(seconds: number) {
    this.position = this.target = this.frame(seconds)
    this.remaining = 0; this.gain = 0; this.active = true
  }
  move(seconds: number, elapsed: number) {
    if (!this.active || !Number.isFinite(seconds) || !Number.isFinite(elapsed)) return
    const target = this.frame(seconds)
    if (target === this.target) return
    this.target = target
    // One destination replaces the previous destination; no queued grains.
    // A small interpolation horizon smooths pointer events and bounds the tail.
    this.remaining = Math.max(1, Math.round(this.outputRate * Math.max(0.008, Math.min(0.04, elapsed + 0.008))))
    this.step = (this.target - this.position) / this.remaining
  }
  stop() { this.active = false; this.remaining = 0; this.gain = 0 }
  render(output: Float32Array[]) {
    for (const channel of output) channel.fill(0)
    if (!this.active || !output.length) return
    for (let i = 0; i < output[0].length && this.remaining > 0; i++) {
      const sample = Math.max(0, Math.min(this.channels[0].length - 1, this.position))
      const left = Math.floor(sample), fraction = sample - left
      this.gain = Math.min(1, this.gain + 1 / 32)
      const gain = Math.min(this.gain, this.remaining / 32)
      for (let channel = 0; channel < output.length; channel++) {
        const source = this.channels[Math.min(channel, this.channels.length - 1)]
        const a = source[left], b = source[Math.min(left + 1, source.length - 1)]
        output[channel][i] = (a + (b - a) * fraction) * gain
      }
      this.position += this.step
      if (--this.remaining === 0) { this.position = this.target; this.gain = 0 }
    }
  }
}
