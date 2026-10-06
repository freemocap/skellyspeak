/** Signal observations, never speech recognition or a microphone quality score.
 * Quiet input is advisory; absent samples indicate a capture delivery failure.
 * Thresholds are conservative initial values requiring device validation. */
export type MicrophoneSignal = 'waiting' | 'sound' | 'quiet' | 'stalled'
export interface MicrophoneHealth { signal: MicrophoneSignal; level: number; detected: boolean }
export class MicrophoneMonitor {
  private lastSamples: number
  private lastSound: number
  private detected = false
  private level = 0
  constructor(began: number) { this.lastSamples = began; this.lastSound = began }
  update(samples: readonly number[], now: number): MicrophoneHealth {
    if (samples.length) {
      this.lastSamples = now
      const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length)
      this.level = Math.max(0, Math.min(1, (20 * Math.log10(Math.max(rms, 1e-6)) + 60) / 60))
      if (rms > 0.001) { this.lastSound = now; this.detected = true }
    } else if (now - this.lastSamples > 500) this.level = 0
    return {
      signal: now - this.lastSamples >= 3000 ? 'stalled'
        : now - this.lastSound >= 4000 ? 'quiet'
        : this.detected ? 'sound' : 'waiting',
      level: this.level, detected: this.detected,
    }
  }
}
