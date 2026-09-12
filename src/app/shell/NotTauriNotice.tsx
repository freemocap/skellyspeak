/// Shown when the interface is loaded without the Rust core. The app is a
/// desktop webview: AI calls, storage and speech-to-text all live behind IPC.
export function NotTauriNotice() {
  return (
    <div className="not-tauri">
      This is the SkellySpeak desktop app UI. Run it with{' '}
      <b>npm run tauri dev</b> from the repo root — the interface
      needs the Rust core for AI calls, storage, and speech-to-text.
    </div>
  )
}
