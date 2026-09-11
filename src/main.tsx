import { reportDiagnosticBridgeFailure } from './lib/faults'
import { installDiagnosticCapture, logDiagnostic } from './lib/log'
import ReactDOM from 'react-dom/client'
import App from './App'
import DevWindow from './DevWindow'
import { isTauri, loadLanguages } from './lib/tauri'
import './styles.css'
import { installPlaybackLifecycle } from './lib/playback-lifecycle'

installDiagnosticCapture()
window.addEventListener('diagnostic-bridge-failed', reportDiagnosticBridgeFailure)
installPlaybackLifecycle()

// The popped-out observability window runs the same bundle as the main one
// and is told apart by its WINDOW LABEL (set by the Rust dev command). Routing on the
// label rather than a URL query avoids putting '?' inside the PathBuf that
// WebviewUrl::App wants.
const DEV_WINDOW_LABEL = 'ai'

async function isDevWindow(): Promise<boolean> {
  if (!isTauri) return false
  const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
  return getCurrentWebviewWindow().label === DEV_WINDOW_LABEL
}

function mount(dev: boolean) {
  const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)
  root.render(dev ? <DevWindow /> : <App />)
}

// The language registry comes from Rust and every picker needs it
// synchronously, so it is fetched before the first render. Outside Tauri
// there is no backend at all — App renders its "run via tauri dev" notice.
async function start() {
  const dev = await isDevWindow()
  if (isTauri && !dev) await loadLanguages()
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
