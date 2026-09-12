import { TEXT_SIZE } from '../../contracts'

export type FontSizeAction = 'increase' | 'decrease' | 'reset'

/// Reading size moves in the steps Rust defines and stays inside its range.
export function applyFontSizeAction(size: number, action: FontSizeAction): number {
  if (action === 'reset') return TEXT_SIZE.default
  const delta = action === 'increase' ? TEXT_SIZE.step : -TEXT_SIZE.step
  return Math.min(TEXT_SIZE.max, Math.max(TEXT_SIZE.min, size + delta))
}

/** The familiar browser/document reading-size shortcuts, on either platform modifier. */
export function fontSizeActionFromShortcut(event: Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey'>): FontSizeAction | null {
  if ((!event.ctrlKey && !event.metaKey) || event.altKey) return null
  if (event.key === '+' || event.key === '=' || event.code === 'NumpadAdd') return 'increase'
  if (event.key === '-' || event.code === 'NumpadSubtract') return 'decrease'
  if (event.key === '0' || event.code === 'Numpad0') return 'reset'
  return null
}
