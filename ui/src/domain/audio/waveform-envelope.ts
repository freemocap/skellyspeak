/** At most two extrema per horizontal pixel, preserving brief positive/negative
 * peaks without asking a software renderer to stroke tens of thousands of points. */
export function waveformEnvelope(samples: readonly number[], capacity: number, width: number): [number, number][] {
  const points: [number, number][] = []
  if (samples.length === 0 || width <= 0 || capacity <= 0) return points
  const pixels = Math.max(1, Math.ceil(width))
  const offset = capacity - samples.length
  let start = 0
  while (start < samples.length) {
    const column = Math.floor((offset + start) * pixels / capacity)
    const end = Math.min(samples.length, Math.max(start + 1, Math.ceil((column + 1) * capacity / pixels) - offset))
    let low = start; let high = start
    for (let i = start + 1; i < end; i++) {
      if (samples[i]! < samples[low]!) low = i
      if (samples[i]! > samples[high]!) high = i
    }
    for (const i of low === high ? [low] : [Math.min(low, high), Math.max(low, high)]) {
      points.push([(offset + i) * width / capacity, samples[i]!])
    }
    start = end
  }
  return points
}
