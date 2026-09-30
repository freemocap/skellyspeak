import { levelPosition, levelThreshold } from '../../domain/learning/statistics/skill-levels'

/// Radar geometry in viewBox units. Arm 0 points up; arms run clockwise in
/// catalog order. The next overall level sits on the ring; each earned level is
/// an equal-width band inside it, so rings stay evenly spaced as thresholds grow.

export interface RadarFrame { view: number; ring: number }
export const PANEL_FRAME: RadarFrame = { view: 480, ring: 125 }
export const GLYPH_FRAME: RadarFrame = { view: 24, ring: 11 }
/** Arms may pass the ring by this much before they are clipped. */
const OVERSHOOT = 1.1

export function armAngle(index: number, count: number): number {
  return (-90 + 360 * index / count) * Math.PI / 180
}

export function polar(frame: RadarFrame, radius: number, index: number, count: number): { x: number; y: number } {
  const angle = armAngle(index, count)
  const centre = frame.view / 2
  return { x: centre + radius * Math.cos(angle), y: centre + radius * Math.sin(angle) }
}

/** Radius of `points` on a radar whose ring is overall level `level + 1`. */
export function armRadius(frame: RadarFrame, points: number, level: number): number {
  return frame.ring * Math.min(levelPosition(points) / (level + 1), OVERSHOOT)
}

/** Radius of the ring for `ringLevel` while the learner is at overall `level`. */
export function ringRadius(frame: RadarFrame, ringLevel: number, level: number): number {
  return armRadius(frame, levelThreshold(ringLevel), level)
}

/** A thick arm that widens from a point at the centre to a rounded end at `tip`. */
export function taperedArm(frame: RadarFrame, tip: { x: number; y: number }, width: number): string {
  const centre = frame.view / 2
  const length = Math.hypot(tip.x - centre, tip.y - centre)
  if (length === 0) return ''
  const [ux, uy] = [(tip.x - centre) / length, (tip.y - centre) / length]
  const [px, py] = [-uy, ux]
  const base = width * 0.12
  const half = width / 2
  return [
    `M ${centre + px * base} ${centre + py * base}`,
    `L ${tip.x + px * half} ${tip.y + py * half}`,
    `A ${half} ${half} 0 0 1 ${tip.x - px * half} ${tip.y - py * half}`,
    `L ${centre - px * base} ${centre - py * base} Z`,
  ].join(' ')
}
