/// Opens a URL in the system browser rather than navigating the app's own
/// webview. The Tauri opener plugin is loaded on demand: nothing outside this
/// call needs it, and its allowed URLs are declared in native/capabilities.
export async function openExternalLink(url: string): Promise<void> {
  const { openUrl } = await import('@tauri-apps/plugin-opener')
  await openUrl(url)
}
