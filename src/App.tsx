import { Component, useEffect, useState, type ReactNode } from 'react'
import { getSettings, isTauri } from './lib/tauri'
import { comboFromEvent } from './lib/keyboard'
import GuidedPage from './pages/GuidedPage'
import StoriesPage from './pages/StoriesPage'
import { SettingsModal } from './components/SettingsModal'
import { LogsOverlay } from './components/LogsOverlay'
import { openOverlay } from './lib/back'

type Page = 'guided' | 'stories'

// Keeps a render crash from blanking the whole app.
class PageBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="not-tauri">
          This view crashed: {this.state.error.message}
          <br />
          <br />
          <button
            type="button"
            className="btn"
            onClick={() => this.setState({ error: null })}
          >
            Reload view
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  const [page, setPage] = useState<Page>('guided')
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Bumped whenever Settings saves — pages watch it and re-fetch settings.
  const [settingsVersion, setSettingsVersion] = useState(0)
  const [showNotTauri, setShowNotTauri] = useState(false)

  // Android back closes the Settings modal instead of exiting the app.
  useEffect(
    () => (settingsOpen ? openOverlay(() => setSettingsOpen(false)) : undefined),
    [settingsOpen]
  )

  // Settings shortcut (configurable, default ctrl+,).
  useEffect(() => {
    if (!isTauri) return
    let shortcuts = { settings: 'ctrl+,' }
    let alive = true
    void getSettings()
      .then((s) => {
        if (alive && s.shortcuts?.settings) shortcuts = s.shortcuts
      })
      .catch(() => {})
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (comboFromEvent(e) === shortcuts.settings) {
        e.preventDefault()
        setSettingsOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      alive = false
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  useEffect(() => {
    if (!isTauri) {
      setShowNotTauri(true)
      return
    }
    void import('./lib/tauri').then(({ getSettings }) =>
      getSettings()
        .then((s) => localStorage.setItem('skellyspeak_target', s.target_language))
        .catch(() => {})
    )
  }, [])

  return (
    <div className="app">
      <div className="topbar">
        <span className="wordmark">
          SKELLYSPEAK<b>·</b>
        </span>
        <div className="tabs">
          <button
            type="button"
            className={`tab ${page === 'guided' ? 'active' : ''}`}
            onClick={() => setPage('guided')}
          >
            Guided
          </button>
          <button
            type="button"
            className={`tab ${page === 'stories' ? 'active' : ''}`}
            onClick={() => setPage('stories')}
          >
            Stories
          </button>
        </div>
        <button
          type="button"
          className="gear"
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          title="Settings"
        >
          ⚙
        </button>
      </div>

      <div className="content">
        {showNotTauri ? (
          <div className="not-tauri">
            This is the SkellySpeak desktop app UI. Run it with{' '}
            <b>npm run tauri dev</b> from the repo root — the interface
            needs the Rust core for AI calls, storage, and speech-to-text.
          </div>
        ) : (
          <>
            {/* Both pages stay MOUNTED — unmounting GuidedPage on tab switch
                destroyed the conversation. Hidden via CSS, not unmounted. */}
            <div
              className={`page-holder ${page === 'guided' ? '' : 'hidden'}`}
              aria-hidden={page !== 'guided'}
            >
              <PageBoundary>
                <GuidedPage settingsVersion={settingsVersion} />
              </PageBoundary>
            </div>
            <div
              className={`page-holder ${page === 'stories' ? '' : 'hidden'}`}
              aria-hidden={page !== 'stories'}
            >
              <PageBoundary>
                <StoriesPage />
              </PageBoundary>
            </div>
          </>
        )}
      </div>

      <LogsOverlay />

      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          onSaved={(s) => {
            localStorage.setItem('skellyspeak_target', s.target_language)
            setSettingsVersion((v) => v + 1)
            setSettingsOpen(false)
          }}
        />
      )}
    </div>
  )
}
