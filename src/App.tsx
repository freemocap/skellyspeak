import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { getSettings, hostedAccount, isTauri, languageFor, takeStartupFaults } from './lib/tauri'
import { uiLangFromNative } from './lib/i18n'
import { comboFromEvent, SHORTCUT_DEFAULTS } from './lib/keyboard'
import { isReloadShortcut } from './lib/reload'
import GuidedPage from './pages/GuidedPage'
import { SkillEvidenceContext, useSkillEvidence } from './hooks/useSkillEvidence'
import { treeNode } from './pages/skillTree'
import { SettingsModal } from './components/SettingsModal'
import { LogsOverlay } from './components/LogsOverlay'
import { UpdateBanner } from './components/UpdateBanner'
import { PausedBanner } from './components/PausedBanner'
import { openOverlay } from './lib/back'
import { useAiActivity } from './hooks/useAiActivity'
import { useIsMobile } from './hooks/useIsMobile'
import { dismissAllFaults, dismissFault, reportFault, subscribeFaults, type Fault } from './lib/faults'
import { HOSTED } from './lib/providers'
import type { Shortcuts } from './types'

type Page = 'guided' | 'skills'
const SkillsPage = lazy(() => import('./pages/SkillsPage'))

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

/// Mirror the native language onto the document: UI strings come from
/// `uiLangFromNative` (lib/i18n) and text direction from the registry, so an
/// Arabic native gets a right-to-left UI rather than just Arabic words.
function applyUiLanguage(native: string) {
  document.documentElement.dir = languageFor(native)?.direction ?? 'ltr'
  document.documentElement.lang = uiLangFromNative(native)
}

export default function App() {
  const [page, setPage] = useState<Page>('guided')
  const [skillsOpened, setSkillsOpened] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Owned here rather than inside LogsOverlay so its button can sit in the
  // topbar beside the gear. As a fixed-position element of its own it never
  // lined up with anything.
  const [devOpen, setDevOpen] = useState(false)
  const aiBusy = useAiActivity()
  const isMobile = useIsMobile()
  // Owned here because the control belongs beside the wordmark, while the
  // conversations it lists belong to the Guided page.
  const [historyOpen, setHistoryOpen] = useState(false)
  // Bumped whenever Settings saves — pages watch it and re-fetch settings.
  const [settingsVersion, setSettingsVersion] = useState(0)
  const evidence = useSkillEvidence(true, settingsVersion)
  const [showNotTauri, setShowNotTauri] = useState(!isTauri)
  // Everything that has gone wrong anywhere in the app, shown at the very top
  // of the window until dismissed. This is the only destination for a failure.
  const [faults, setFaults] = useState<Fault[]>([])
  useEffect(() => subscribeFaults(setFaults), [])

  // Faults the Rust core recorded before this webview existed get pushed onto
  // the same bus, so a startup problem is as visible as a runtime one.
  useEffect(() => {
    if (!isTauri) return
    void takeStartupFaults()
      .then((startup) => startup.forEach((m) => reportFault('Startup', m)))
      .catch((e) => reportFault('Reading startup diagnostics', e))
  }, [])

  // Android back closes the Settings modal instead of exiting the app.
  useEffect(
    () => (settingsOpen ? openOverlay(() => setSettingsOpen(false)) : undefined),
    [settingsOpen]
  )

  // Settings are read ONCE here and everything on this screen derives from
  // that read. Three separate loads raced each other on mount, and two of them
  // swallowed their failure, so a settings problem showed up as a shortcut
  // that quietly did nothing.
  const [shortcuts, setShortcuts] = useState<Shortcuts>(SHORTCUT_DEFAULTS)
  useEffect(() => {
    if (!isTauri) {
      setShowNotTauri(true)
      return
    }
    void getSettings()
      .then(async (s) => {
        if (s.shortcuts?.settings) setShortcuts(s.shortcuts)
        applyUiLanguage(s.native_language)
        // Check in with the hosted service while there is still time to do
        // something about an expired session — it otherwise first shows up as
        // a failed reply mid-conversation — and to keep the device record
        // current rather than frozen at the last sign-in.
        if (s.provider_mode === HOSTED && s.hosted_email) {
          await hostedAccount()
        }
      })
      .catch((e) => reportFault('Loading settings', e))
  }, [])

  // Settings shortcut (configurable, default ctrl+,).
  useEffect(() => {
    if (!isTauri) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (comboFromEvent(e) === shortcuts.settings) {
        e.preventDefault()
        setSettingsOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shortcuts])

  // Desktop webviews do not consistently supply a browser-style refresh
  // command. Own the familiar shortcut at the app shell so it works on every
  // screen, including when a field has focus.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isReloadShortcut(event)) return
      event.preventDefault()
      window.location.reload()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="app">
      <div className="topbar">
        {page === 'guided' && (
          <button
            type="button"
            className="hamburger"
            aria-label="Chat history"
            aria-expanded={historyOpen}
            title="Chat history"
            onClick={() => setHistoryOpen((v) => !v)}
          >
            ☰
          </button>
        )}
        <span className="wordmark">
          SKELLYSPEAK<b>·</b>
        </span>
        <div className="tabs" aria-label="Main navigation">
          <button type="button" className={`tab ${page === 'guided' ? 'active' : ''}`} onClick={() => setPage('guided')}>Guided conversation</button>
          <button type="button" className={`tab ${page === 'skills' ? 'active' : ''}`} onClick={() => { setSkillsOpened(true); setPage('skills') }}>Skill tree</button>
        </div>
        {/* Mobile reaches the same panel by swiping to its third surface, so
            the topbar button is desktop-only. */}
        {!isMobile && (
          <button
            type="button"
            className={`inside-btn ${devOpen ? 'open' : ''} ${aiBusy ? 'busy' : ''}`}
            onClick={() => setDevOpen((v) => !v)}
            aria-label="AI"
            aria-expanded={devOpen}
            title="AI — understand recent activity, inspect a pipeline, or open debugging tools"
          >
            <span className="inside-dot" aria-hidden="true" />
            AI
          </button>
        )}
        <button
          type="button"
          className="gear"
          onClick={() => window.location.reload()}
          aria-label="Reload app"
          title="Reload app (⌘/Ctrl+R)"
        >
          ↻
        </button>
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

      {isTauri && <UpdateBanner />}

      {/* A paused pipeline is indistinguishable from a hung app unless something
          says so. This is that something, and it is deliberately outside the
          panel that can set it. */}
      <PausedBanner />

      {faults.length > 0 && (
        <div className="fault-bar" role="alert">
          {faults.map((f) => (
            <p key={f.id} className="fault">
              <b>{f.context}:</b> {f.message}
              <button
                type="button"
                className="fault-dismiss"
                aria-label="Dismiss"
                onClick={() => dismissFault(f.id)}
              >
                ✕
              </button>
            </p>
          ))}
          {faults.length > 1 && (
            <button type="button" className="btn tiny" onClick={dismissAllFaults}>
              Dismiss all
            </button>
          )}
        </div>
      )}

      {isTauri && <div className="learner-profile-bar">
        <button onClick={() => { setSkillsOpened(true); setPage('skills') }} aria-label="Open language profile">
          <span>◈ My language profile</span>
          {evidence.snapshot && <><b>{evidence.snapshot.target}</b><span data-reward-total>{evidence.snapshot.profile.xp} XP · ★ {evidence.snapshot.profile.skills.filter((s) => s.star).length}</span><span className="profile-focus">◆ {treeNode(evidence.snapshot.profile.active_focus).label}</span></>}
          {!evidence.snapshot && <span>{evidence.error ? 'Profile unavailable' : 'Loading…'}</span>}
        </button>
        {evidence.error && <span role="alert">{evidence.error}<button onClick={evidence.refresh}>Retry</button></span>}
      </div>}
      <div className="content">
        {skillsOpened && <div className={`page-holder ${page === 'skills' ? '' : 'hidden'}`} aria-hidden={page !== 'skills'}>
          <PageBoundary><Suspense fallback={<p role="status">Loading skill tree…</p>}><SkillsPage evidence={evidence} onPractice={() => setPage('guided')} /></Suspense></PageBoundary>
        </div>}
        {showNotTauri ? (page !== 'skills' &&
          <div className="not-tauri">
            This is the SkellySpeak desktop app UI. Run it with{' '}
            <b>npm run tauri dev</b> from the repo root — the interface
            needs the Rust core for AI calls, storage, and speech-to-text.
          </div>
        ) : (
          <>
            {/* GuidedPage stays MOUNTED — unmounting it on tab switch
                destroyed the conversation. Hidden via CSS, not unmounted. */}
            <div
              className={`page-holder ${page === 'guided' ? '' : 'hidden'}`}
              aria-hidden={page !== 'guided'}
            >
              <PageBoundary>
                <SkillEvidenceContext value={evidence}><GuidedPage
                  settingsVersion={settingsVersion}
                  historyOpen={historyOpen}
                  onHistoryOpenChange={setHistoryOpen}
                  onOpenSettings={() => setSettingsOpen(true)}
                /></SkillEvidenceContext>
              </PageBoundary>
            </div>
          </>
        )}
      </div>

      <LogsOverlay open={devOpen} onOpenChange={setDevOpen} />

      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          // Fires on every autosave, mid-edit. It must NOT close the modal:
          // closing is the Close button's job (and the Android back
          // gesture's, via openOverlay).
          onSettingsChanged={(s) => {
            applyUiLanguage(s.native_language)
            setSettingsVersion((v) => v + 1)
          }}
        />
      )}
    </div>
  )
}
