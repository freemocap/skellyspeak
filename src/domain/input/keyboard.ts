// Keyboard shortcut dialect: normalized "ctrl+shift+l" strings, compared
// case-insensitively. Defaults mirrored from settings.rs (Shortcuts).

export const SHORTCUT_DEFAULTS = {
  mic: 'ctrl+m',
  speak: 'ctrl+l',
  panel: 'ctrl+b',
  settings: 'ctrl+,',
} as const

export type ShortcutAction = keyof typeof SHORTCUT_DEFAULTS

type ComboKey = Pick<
  KeyboardEvent,
  'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey' | 'key'
>

export function comboFromEvent(e: ComboKey): string {
  const parts: string[] = []
  if (e.ctrlKey) parts.push('ctrl')
  if (e.altKey) parts.push('alt')
  if (e.shiftKey) parts.push('shift')
  if (e.metaKey) parts.push('meta')
  parts.push(e.key.toLowerCase())
  return parts.join('+')
}
