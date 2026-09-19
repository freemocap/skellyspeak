import { isTauri } from './tauri'
import { invoke } from './native'
import type { AiViewSelection, AiWindowState, AiGraphDefinition } from '../../generated/contracts'

/// The label of the webview this bundle runs in, or null outside Tauri.
///
/// The popped-out observability window runs the same bundle as the main window
/// and is told apart by its label, which the Rust dev command sets. Routing on
/// the label rather than a URL query keeps `?` out of the PathBuf that
/// `WebviewUrl::App` wants.
export async function currentWindowLabel(): Promise<string | null> {
  if (!isTauri) return null
  const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
  return getCurrentWebviewWindow().label
}

/// Whether this build can pop the AI View out, and whether that window exists.
/// Outside Tauri there is no second window to open.
export function aiWindowState(): Promise<AiWindowState> {
  if (!isTauri) return Promise.resolve({ supported: false, open: false })
  return invoke<AiWindowState>('ai_window_state')
}

export function openAiWindow(): Promise<void> {
  return invoke<void>('open_ai_window')
}

/// From the AI window: return the view to the main window's panel.
export function dockAiWindow(): Promise<void> {
  return invoke<void>('dock_ai_window')
}

export function setAiViewSelection(selection: AiViewSelection | null): Promise<void> {
  if (!isTauri) return Promise.resolve()
  return invoke<void>('set_ai_view_selection', { selection })
}

export function getAiViewSelection(): Promise<AiViewSelection | null> {
  if (!isTauri) return Promise.resolve(null)
  return invoke<AiViewSelection | null>('get_ai_view_selection')
}

export type AiWindowEvent = 'docked' | 'changed'

/// Hints from native that the AI window moved. They only prompt a re-read of
/// `aiWindowState`; the state itself is never inferred from an event.
export async function onAiWindowEvent(handler: (event: AiWindowEvent) => void): Promise<() => void> {
  if (!isTauri) return () => {}
  const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
  const window = getCurrentWebviewWindow()
  const unlisten = await Promise.all([
    window.listen('ai-view-docked', () => handler('docked')),
    window.listen('ai-window-changed', () => handler('changed')),
  ])
  return () => unlisten.forEach(stop => stop())
}

/** Static native declarations; this command cannot dispatch work. */
export function getAiGraphDefinitions(): Promise<AiGraphDefinition[]> {
  return invoke<AiGraphDefinition[]>('get_ai_graph_definitions')
}
