/** Coalesce worklet frames while IPC is occupied. One request at a time preserves
 * native sequencing, but one delayed acknowledgement must not strand a separate
 * round trip for every tiny frame already waiting behind it. */
export class PcmDelivery {
  private chunks: Float32Array[] = []
  private pending = 0
  private sequence = 0
  private stopped = false
  private failure: unknown
  private delivery: Promise<void> | null = null
  constructor(private rate: number, private push: (samples: number[], rate: number, sequence: number) => Promise<void>, private fail: (error: unknown) => void) {}

  enqueue(samples: Float32Array) {
    if (this.stopped) return
    this.pending += samples.length
    if (this.pending > this.rate * 2) {
      const error = Object.assign(new Error('Microphone audio delivery fell behind. Listening stopped.'), {
        diagnostics: { stage: 'browser_pcm_delivery', sampleRate: this.rate, pendingSamples: this.pending, pendingSeconds: this.pending / this.rate, submittedBatches: this.sequence },
      })
      this.failure = error; this.cancel(); this.fail(error); return
    }
    this.chunks.push(samples)
    this.start()
  }

  private start() {
    if (this.delivery || this.stopped || !this.chunks.length) return
    this.delivery = this.drain().catch(error => { this.failure = error; this.cancel(); this.fail(error) }).finally(() => {
      this.delivery = null
      this.start()
    })
  }

  private async drain() {
    while (!this.stopped && this.chunks.length) {
      const batch: number[] = []
      // The native transport accepts at most 8192 samples, regardless of rate.
      while (this.chunks.length && batch.length < 8192) {
        const chunk = this.chunks[0]
        const count = Math.min(chunk.length, 8192 - batch.length)
        for (let i = 0; i < count; i++) batch.push(chunk[i])
        if (count === chunk.length) this.chunks.shift()
        else this.chunks[0] = chunk.subarray(count)
      }
      await this.push(batch, this.rate, this.sequence++)
      this.pending -= batch.length
    }
  }

  async finish() {
    while (this.delivery) await this.delivery
    if (this.failure !== undefined) throw this.failure
  }
  cancel() { this.stopped = true; this.chunks = [] }
}
