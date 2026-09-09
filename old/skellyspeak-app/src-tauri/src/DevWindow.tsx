import { DevPanel } from './components/dev/DevPanel'

// The popped-out observability window. Same DevPanel as the docked sheet and
// the mobile surface — it just owns the whole viewport.
//
// The trace bus reaches it for free: Tauri's `app.emit` broadcasts to every
// window, so `subscribeRuns` here sees the same runs as the main window.
export default function DevWindow() {
  return <div className="dev-window">
    <DevPanel />
  </div>
}
