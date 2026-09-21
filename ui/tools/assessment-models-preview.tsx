/** Real settings component with session-only IPC fixtures; no AI or saved app changes. */
import { mockIPC } from '@tauri-apps/api/mocks'
import { createRoot } from 'react-dom/client'
import { I18nProvider } from '../src/components/localization/i18n'
import { SettingsModels } from '../src/features/settings/models/SettingsModels'
import type { ConnectionConfig } from '../src/generated/contracts'
import '../src/styles/index.css'
let settings: ConnectionConfig = {
  assessmentAdapter: 'chat_model', route: 'openrouter', signedIn: false, ownKeyConfigured: true,
  email: '', revision: 1, configured: true, standardModel: 'google/gemini-2.5-flash', fastModel: 'google/gemini-2.5-flash-lite',
  audio: { transcription: { model: 'scribe_v2' }, speech: { model: 'eleven_v3' } }, paused: false,
}
mockIPC((command, args) => {
  if (command === 'get_connection') return settings
  if (command === 'save_models') { settings = { ...settings, ...(args as object), revision: settings.revision + 1 }; return settings }
  throw new Error('Unsupported preview action: ' + command)
})
createRoot(document.getElementById('root')!).render(<I18nProvider locale="english"><main style={{ maxWidth: 700, margin: '24px auto', padding: 16 }}>
  <p>Component preview · session-only settings · no AI calls</p><h1>Models</h1>
  <SettingsModels onBusyChange={() => {}} onChanged={async () => {}} />
</main></I18nProvider>)
