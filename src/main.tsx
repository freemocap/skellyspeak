import ReactDOM from 'react-dom/client'
import App from './App'
import DevWindow from './DevWindow'
import { isTauri, loadLanguages } from './lib/tauri'
import './styles.css'

// The popped-out observability window runs the same bundle as the main one
// and is told apart by its WINDOW LABEL (set in commands.rs). Routing on the
// label rather than a URL query avoids putting '?' inside the PathBuf that
// WebviewUrl::App wants.
const DEV_WINDOW_LABEL = 'skellyspeak-dev'

async function isDevWindow(): Promise<boolean> {
  if (!isTauri) return false
  const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
  return getCurrentWebviewWindow().label === DEV_WINDOW_LABEL
}

// NOTE: No StrictMode — its dev-only double-invocation of effects makes the
// greeting turn (6 AI calls) fire twice on every mount. Mount effects here
// are not idempotent-cheap, so StrictMode's safety net costs real money.
function mount(dev: boolean) {
  const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)
  root.render(dev ? <DevWindow /> : <App />)
}

// The language registry comes from Rust and every picker needs it
// synchronously, so it is fetched before the first render. Outside Tauri
// there is no backend at all — App renders its "run via tauri dev" notice.
void isDevWindow().then((dev) => {
  // The dev window renders the panel alone and needs no language registry.
  if (isTauri && !dev) {
    void loadLanguages().then(() => mount(false))
  } else {
    mount(dev)
  }
})
