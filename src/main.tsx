import { reportDiagnosticBridgeFailure, reportFault, reportUnhandledError } from './platform/diagnostics/faults'
import { installDiagnosticCapture, logDiagnostic } from './platform/diagnostics/log'
import ReactDOM from 'react-dom/client'
import App from './App'
import DevWindow from './DevWindow'
import { isTauri, invoke, loadLanguages } from './platform/ipc/tauri'
import type { AppError, StartupState } from './contracts'
import { StartupRefusal } from './features/startup/StartupRefusal'
import './styles/index.css'
import { installNativePlaybackLifecycle, installPlaybackLifecycle } from './platform/playback-lifecycle'
import { currentWindowLabel } from './platform/ipc/window'
import { initStores } from './state/init'

installDiagnosticCapture()
window.addEventListener('diagnostic-bridge-failed', reportDiagnosticBridgeFailure)
window.addEventListener('unhandled-ui-error', reportUnhandledError)
// The web lifecycle covers focus, visibility and pagehide. Only the native
// window events cover a desktop suspend or close, so both are installed; the
// unlisten they return lasts as long as the process does.
const playback = installPlaybackLifecycle()
if (isTauri) {
  void installNativePlaybackLifecycle(playback)
    .catch((error: unknown) => reportFault('Installing native playback lifecycle', error))
}

// The popped-out observability window runs the same bundle as the main one
// and is told apart by its WINDOW LABEL (set by the Rust dev command). Routing on the
// label rather than a URL query avoids putting '?' inside the PathBuf that
// WebviewUrl::App wants.
const DEV_WINDOW_LABEL = 'ai'

async function isDevWindow(): Promise<boolean> {
  return await currentWindowLabel() === DEV_WINDOW_LABEL
}

function mount(dev: boolean) {
  const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)
  root.render(dev ? <DevWindow /> : <App />)
}

/// A refused workspace has no store, so the shell cannot mount. The reason and
/// the reset are all this screen can offer, and they are enough to recover.
function mountRefusal(error: AppError) {
  const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)
  root.render(<StartupRefusal error={error} />)
}

// The language registry comes from Rust and every picker needs it
// synchronously, so it is fetched before the first render. Outside Tauri
// there is no backend at all — App renders its "run via tauri dev" notice.
async function start() {
  const dev = await isDevWindow()
  if (isTauri && !dev) {
    const startup = await invoke<StartupState>('get_startup_state')
    if (startup.refusal) { mountRefusal(startup.refusal); return }
    // A reset that could not finish clearing is reported rather than discarded.
    if (startup.cleanup) reportFault('Finishing the factory reset', new Error(startup.cleanup.message))
    await loadLanguages()
    await initStores()
  }
  mount(dev)
}
void start().catch(async (error: unknown) => {
  await logDiagnostic('startup', error)
  const message = error instanceof Error ? error.message
    : typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : String(error)
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <div className="not-tauri" role="alert">
      <p>Could not open SkellySpeak: {message}</p>
      <button className="btn" onClick={() => window.location.reload()}>Retry startup</button>
    </div>
  )
})
