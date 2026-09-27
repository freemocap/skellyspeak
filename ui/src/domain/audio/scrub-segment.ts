/** Invert the same display warp that paints the spectrum and playback cursor. */
export function scrubTime(fraction: number, duration: number, displayDuration: number,
  mapTime?: ((time: number) => number) | null) {
  const position = Math.max(0, Math.min(1, fraction))
  if (!mapTime) return Math.min(duration, position * displayDuration)
  const displayed = position * displayDuration
  let low = 0, high = duration
  for (let i = 0; i < 40; i++) {
    const middle = (low + high) / 2
    if (mapTime(middle) < displayed) low = middle
    else high = middle
  }
  return (low + high) / 2
}
