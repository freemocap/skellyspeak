export interface PinPosition { left: number; top: number }

const RING_ANGLE_STEPS = 12
const MAX_RINGS = 8

function collidesWithAny(point: PinPosition, placed: readonly PinPosition[], minGap: number): boolean {
  return placed.some(other => Math.hypot(other.left - point.left, other.top - point.top) < minGap)
}

/// Nudge pins that would land within `minGap` of an already-placed pin, so
/// every numbered marker stays individually visible and clickable even when
/// its target sits close to another stop's at thumbnail scale. Input order
/// sets placement priority: earlier pins keep their exact target position; a
/// later pin that collides is pushed to the nearest clear spot found on a
/// ring around its original position, widening the ring until one clears
/// every already-placed pin. A pin with no collision is left exactly where
/// its target puts it.
export function declutterPins(positions: readonly PinPosition[], minGap: number): PinPosition[] {
  const placed: PinPosition[] = []
  for (const position of positions) {
    placed.push(collidesWithAny(position, placed, minGap) ? resolve(position, placed, minGap) : position)
  }
  return placed
}

function resolve(position: PinPosition, placed: readonly PinPosition[], minGap: number): PinPosition {
  for (let ring = 1; ring <= MAX_RINGS; ring++) {
    const radius = ring * minGap
    for (let step = 0; step < RING_ANGLE_STEPS; step++) {
      const angle = (2 * Math.PI * step) / RING_ANGLE_STEPS
      const candidate = { left: position.left + radius * Math.cos(angle), top: position.top + radius * Math.sin(angle) }
      if (!collidesWithAny(candidate, placed, minGap)) return candidate
    }
  }
  // Every ring searched stayed within minGap of some already-placed pin: an
  // implausibly dense cluster. Leave the pin at its target rather than loop
  // forever; it may still overlap, but it is never lost off-screen.
  return position
}
