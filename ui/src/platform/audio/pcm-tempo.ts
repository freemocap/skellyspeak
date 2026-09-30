// Pitch-preserving overlap/add on mono speech. Native samples remain unchanged;
// this is playback presentation only. [@speech_time_scale_review]
export const PCM_RATE = 24_000
export const PCM_LIMIT = (4 * 1024 * 1024 - 44) / 2
const HOP = 480
const SEARCH = 240

export function pcmBytes(encoded: string): Uint8Array {
  if (encoded.length > 6 * 1024 * 1024) throw new Error('Speech audio exceeds playback limits.')
  const bytes = Uint8Array.from(atob(encoded), value => value.charCodeAt(0))
  if (bytes.length % 2) throw new Error('Speech contains an incomplete PCM sample.')
  return bytes
}

/** Decode only the internal complete WAV contract, without a second audio device. */
export function wavPcm(encoded: string): Uint8Array {
  const bytes = pcmBytes(encoded)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const tag = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4))
  if (bytes.length < 44 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE' || view.getUint32(4, true) + 8 !== bytes.length) throw new Error('Invalid completed speech WAV.')
  let format = false
  let pcm: Uint8Array | null = null
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const size = view.getUint32(offset + 4, true)
    const begin = offset + 8
    if (begin + size > bytes.length) throw new Error('Truncated completed speech WAV.')
    if (tag(offset) === 'fmt ') {
      format = size >= 16 && view.getUint16(begin, true) === 1 && view.getUint16(begin + 2, true) === 1 && view.getUint32(begin + 4, true) === PCM_RATE && view.getUint16(begin + 14, true) === 16
    }
    if (tag(offset) === 'data') {
      if (pcm) throw new Error('Duplicate speech PCM data.')
      pcm = bytes.subarray(begin, begin + size)
    }
    offset = begin + size + size % 2
  }
  if (!format || !pcm?.length || pcm.length % 2 || pcm.length / 2 > PCM_LIMIT) throw new Error('Invalid completed speech PCM.')
  return pcm
}

/** Incremental WSOLA: 40 ms windows, 20 ms hops, bounded similarity search.
 * At ordinary speed the samples pass through exactly; speed never transposes pitch.
 * Lookahead is required before emitting a hop, making network chunk boundaries irrelevant. */
export class PcmTempo {
  private samples = new Float32Array(0)
  length = 0
  position = 0
  complete = false
  private tail: Float32Array | null = null
  private previous = 0
  private previousRate = 1

  append(bytes: Uint8Array, offset: number): void {
    if (this.complete || offset !== this.length || bytes.length % 2 || this.length + bytes.length / 2 > PCM_LIMIT) throw new Error('Speech stream sample sequence is invalid.')
    const required = this.length + bytes.length / 2
    if (required > this.samples.length) {
      const buffer = new Float32Array(Math.min(PCM_LIMIT, Math.max(required, this.samples.length * 2, PCM_RATE)))
      buffer.set(this.samples); this.samples = buffer
    }
    const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    for (let i = 0; i < bytes.length / 2; i++) this.samples[this.length + i] = data.getInt16(i * 2, true) / 32768
    this.length = required
  }

  finish(bytes: Uint8Array): void {
    if (bytes.length / 2 < this.length) throw new Error('Completed speech is shorter than its stream.')
    const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    for (let i = 0; i < this.length; i++) if (data.getInt16(i * 2, true) / 32768 !== this.samples[i]) throw new Error('Completed speech does not match its stream.')
    this.append(bytes.subarray(this.length * 2), this.length)
    this.complete = true
  }

  seek(sample: number): void {
    this.position = Math.max(0, Math.min(this.length, sample))
    this.tail = null
  }

  next(rate: number): { samples: Float32Array; from: number; to: number } | null {
    if (!Number.isFinite(rate) || rate < 0.5 || rate > 1.5) throw new Error('Invalid voice playback speed.')
    if (this.position >= this.length || (!this.complete && this.position + HOP * 2 + SEARCH > this.length)) return null
    const from = this.position
    const count = Math.min(HOP, Math.ceil((this.length - from) / rate))
    let start = Math.round(from)
    if (this.tail) {
      if (rate === 1 && this.previousRate === 1) start = this.previous + HOP
      else {
        // Prefer proximity when silence gives equally good matches. Correlation
        // uses every fourth sample; the chosen offset still has sample precision.
        const target = start
        let best = -Infinity
        const low = Math.max(0, start - SEARCH)
        const high = Math.min(this.length - HOP * 2, start + SEARCH)
        for (let candidate = low; candidate <= high; candidate++) {
          let dot = 0; let energy = 0
          for (let i = 0; i < HOP; i += 4) {
            const sample = this.samples[candidate + i]
            dot += this.tail[i] * sample; energy += sample * sample
          }
          const score = dot / Math.sqrt(energy + 1e-12) - Math.abs(candidate - target) * 1e-7
          if (score > best) { best = score; start = candidate }
        }
      }
    }
    const output = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const sample = this.samples[start + i] ?? 0
      const mix = 0.5 - 0.5 * Math.cos(Math.PI * i / HOP)
      output[i] = this.tail ? this.tail[i] * (1 - mix) + sample * mix : sample
    }
    this.tail = new Float32Array(HOP)
    this.tail.set(this.samples.subarray(start + HOP, Math.min(this.length, start + HOP * 2)))
    this.previous = start; this.previousRate = rate
    this.position = Math.min(this.length, from + count * rate)
    return { samples: output, from, to: this.position }
  }
}
