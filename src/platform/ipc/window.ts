import { isTauri } from './tauri'

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
