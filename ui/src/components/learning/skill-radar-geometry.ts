/// Radar geometry in viewBox units. Arm 0 points up; arms run clockwise in
/// catalog order. `ring` is the gold goal ring's radius in normalized view;
/// lengths along an arm come from `skill-chart-scale.ts` as fractions of it.

export interface RadarFrame { view: number; ring: number }
/** The panel ring leaves room inside the square for a name at the end of every arm. */
export const PANEL_FRAME: RadarFrame = { view: 480, ring: 125 }
/** Arm names sit this far out, past the longest arm and its end dot. */
export const LABEL_RADIUS = 1.22
export const GLYPH_FRAME: RadarFrame = { view: 24, ring: 11 }

export function armAngle(index: number, count: number): number {
  return (-90 + 360 * index / count) * Math.PI / 180
}

export function polar(frame: RadarFrame, radius: number, index: number, count: number): { x: number; y: number } {
  const angle = armAngle(index, count)
  const centre = frame.view / 2
  return { x: centre + radius * Math.cos(angle), y: centre + radius * Math.sin(angle) }
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

/** Midpoint of two points. */
export function midpoint(a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/** Each skill's share of the shape: centre, halfway to the previous tip, its own tip, halfway to the next. */
export function skillWedges(frame: RadarFrame, tips: { x: number; y: number }[]): { x: number; y: number }[][] {
  const centre = { x: frame.view / 2, y: frame.view / 2 }
  return tips.map((tip, index) => {
    const before = midpoint(tips[(index + tips.length - 1) % tips.length], tip)
    const after = midpoint(tip, tips[(index + 1) % tips.length])
    return [centre, before, tip, after]
  })
}

/** Where an arm's name anchors against its end: above the top arm, below the bottom one, beside the rest. */
export function labelSide(index: number, count: number): 'top' | 'bottom' | 'left' | 'right' {
  const angle = armAngle(index, count)
  const [x, y] = [Math.cos(angle), Math.sin(angle)]
  if (Math.abs(x) < 0.3) return y < 0 ? 'top' : 'bottom'
  return x > 0 ? 'right' : 'left'
}
