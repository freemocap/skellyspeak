export interface PayoutTiming {
  intervalMs: number
  shape: 'steady' | 'accelerate' | 'decelerate' | 'swell' | 'swing'
  strength: number
  variation: number
  distribution: 'uniform' | 'centered' | 'smooth'
}
export const DEFAULT_PAYOUT_TIMING: PayoutTiming = {
  intervalMs: 120, shape: 'steady', strength: 50, variation: 0, distribution: 'centered',
}
/** Twelve ordered onsets. Variation changes gaps, never the order of coins. */
export function payoutOnsets(timing: PayoutTiming, random = Math.random, count = 12): number[] {
  if (!Number.isInteger(count) || count < 1 || count > 32) throw new Error('Invalid payout count')
  const { intervalMs, strength, variation } = timing
  if (!Number.isFinite(intervalMs) || intervalMs < 40 || intervalMs > 600
    || !Number.isFinite(strength) || strength < 0 || strength > 80
    || !Number.isFinite(variation) || variation < 0 || variation > 80) throw new Error('Invalid payout timing')
  const onsets = [0]
  let drift = 0
  for (let index = 0; index < count - 1; index++) {
    const phase = index / Math.max(1, count - 2)
    const curve = timing.shape === 'accelerate' ? 1 - 2 * phase
      : timing.shape === 'decelerate' ? 2 * phase - 1
      : timing.shape === 'swell' ? Math.cos(phase * Math.PI * 2)
      : timing.shape === 'swing' ? (index % 2 === 0 ? 1 : -1) : 0
    let noise = random() * 2 - 1
    if (timing.distribution === 'centered') noise = (noise + random() * 2 - 1) / 2
    if (timing.distribution === 'smooth') { drift = drift * .65 + noise * .35; noise = drift }
    const gap = Math.max(30, intervalMs * (1 + curve * strength / 100) * (1 + noise * variation / 100))
    onsets.push(onsets[index] + gap)
  }
  return onsets
}
