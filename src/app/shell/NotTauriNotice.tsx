import { useI18n } from '../../ui/i18n'
/// Shown when the interface is loaded without the Rust core. The app is a
/// desktop webview: AI calls, storage and speech-to-text all live behind IPC.
export function NotTauriNotice() {
  const tr = useI18n()
  return (
    <div className="not-tauri">
      {tr("This is the SkellySpeak desktop app UI. Run it with")}{' '}
      <b>npm run tauri dev</b> {tr(" from the repo root — the interface needs the Rust core for AI calls, storage, and speech-to-text.")}</div>
  )
}
