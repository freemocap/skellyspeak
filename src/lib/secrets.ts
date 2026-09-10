/// Display masking for API keys.
///
/// Mirrors `settings::mask` in src-tauri/src/settings.rs CHARACTER FOR
/// CHARACTER. That matters: `save_settings` decides "the user did not touch
/// this field, keep the stored key" by comparing the value the webview sends
/// back against its own `mask(stored)`. If the two ever disagree, a save would
/// overwrite a real key with a string of bullets.
///
/// `Array.from` (not `.length`/`.slice`) to match Rust's `chars()` — both
/// count Unicode code points, so a key with astral characters masks the same
/// on both sides.

const BULLETS = '••••••••'

export function maskKey(key: string): string {
  const chars = Array.from(key)
  if (chars.length < 12) return '•'.repeat(chars.length)
  return chars.slice(0, 6).join('') + BULLETS + chars.slice(-6).join('')
}

/// True if this value came from the backend already masked, rather than being
/// raw key material the user just entered.
export function isMasked(value: string): boolean {
  return value.includes('•')
}

/// What the settings box shows. Raw key material is masked on its way to the
/// screen, so a key is never rendered in the clear — not after a save, not
/// while it is being pasted, not in a screenshot.
export function displaySecret(value: string): string {
  if (!value) return ''
  return isMasked(value) ? value : maskKey(value)
}
