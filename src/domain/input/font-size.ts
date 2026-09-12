export const FONT_SIZE_DEFAULT = 100
export const FONT_SIZE_MIN = 75
export const FONT_SIZE_MAX = 150
export const FONT_SIZE_STEP = 5

export type FontSizeAction = 'increase' | 'decrease' | 'reset'

export function applyFontSizeAction(size: number, action: FontSizeAction): number {
  if (action === 'reset') return FONT_SIZE_DEFAULT
  const delta = action === 'increase' ? FONT_SIZE_STEP : -FONT_SIZE_STEP
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, size + delta))
}

/** The familiar browser/document reading-size shortcuts, on either platform modifier. */
export function fontSizeActionFromShortcut(event: Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey'>): FontSizeAction | null {
  if ((!event.ctrlKey && !event.metaKey) || event.altKey) return null
  if (event.key === '+' || event.key === '=' || event.code === 'NumpadAdd') return 'increase'
  if (event.key === '-' || event.code === 'NumpadSubtract') return 'decrease'
  if (event.key === '0' || event.code === 'Numpad0') return 'reset'
  return null
}
