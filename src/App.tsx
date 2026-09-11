import { UpdateBanner } from './components/UpdateBanner'
import { configureAudioVolumes } from './lib/audio-volume'
import { ReadingProvider } from './components/TargetText'
import { ToolbarIcon } from './components/ToolbarIcon'
import { ActiveSurfaceContext } from './hooks/useOverlayLayer'
import { ProgressSummary } from './components/panes/ProgressSummary'
import { SkillNavigationProvider, useSkillNavigation } from './hooks/useSkillNavigation'
import { Component, lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react'
import { getSettings, saveSettings, isTauri, languageFor, languages } from './lib/tauri'
import { uiLangFromNative } from './lib/i18n'
import { comboFromEvent, SHORTCUT_DEFAULTS } from './lib/keyboard'
import { isReloadShortcut } from './lib/reload'
import GuidedPage, { type MobileLocation } from './pages/GuidedPage'
import { DetailDialog } from './components/DetailDialog'
import { SkillEvidenceContext, useSkillEvidence } from './hooks/useSkillEvidence'
import { SettingsModal } from './components/SettingsModal'
import { LogsOverlay } from './components/LogsOverlay'
import { openOverlay } from './lib/back'
import { usePracticeSwipe } from './hooks/usePracticeSwipe'
import { useIsMobile } from './hooks/useIsMobile'
import { dismissAllFaults, dismissFault, reportFault, subscribeFaults, type Fault } from './lib/faults'
import type { Settings, Shortcuts } from './types'

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

export default function App() { return <SkillNavigationProvider><Application /></SkillNavigationProvider> }

function Application() {
  const navigation = useSkillNavigation()
  const [page, setPage] = useState<Page>('guided')
  const [newChatAction, setNewChatAction] = useState<(() => void) | null>(null)
  const registerNewChat = useCallback((action: (() => void) | null) => setNewChatAction(() => action), [])
  const [mobileSurface, setMobileSurface] = useState<MobileLocation>('chat')
  const [moreOpen, setMoreOpen] = useState(false)
  function openPractice(surface: MobileLocation) {
    setPage('guided')
    setMobileSurface(surface)
    setDevOpen(false)
    setMoreOpen(false)
  }
  useEffect(() => { if (navigation.state.mapRequest) { setSkillsOpened(true); setPage('skills') } }, [navigation.state.mapRequest])
  const [progressOpen, setProgressOpen] = useState(false)
  const [skillsOpened, setSkillsOpened] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsBusy, setSettingsBusy] = useState(false)
  // Owned here rather than inside LogsOverlay so its button can sit in the
  // topbar beside the gear. As a fixed-position element of its own it never
  // lined up with anything.
  const [devOpen, setDevOpen] = useState(false)
  const aiBusy = false // Activity requires the native operation snapshot; no old trace subscription.
  const isMobile = useIsMobile()
  useEffect(() => isMobile && page === 'skills' ? openOverlay(() => setPage('guided')) : undefined, [isMobile, page])
  // Owned here because the control belongs beside the wordmark, while the
  // conversations it lists belong to the Guided page.
  const [historyOpen, setHistoryOpen] = useState(false)
  const swipe = usePracticeSwipe(direction => openPractice(direction === 'next' ? 'panel' : 'chat'), isMobile && page === 'guided' && !historyOpen && !moreOpen && !devOpen && !settingsOpen)
  // Bumped whenever Settings saves — pages watch it and re-fetch settings.
  const [settingsVersion, setSettingsVersion] = useState(0)
  const [settings, setSettings] = useState<Settings | null>(null)
  useEffect(() => {
    if (!settings) return
    try { configureAudioVolumes(settings) }
    catch (error) { reportFault('Audio settings', error); setSettings(null) }
  }, [settings === null, settings?.master_volume, settings?.voice_volume, settings?.effects_volume])
  const [savingLanguage, setSavingLanguage] = useState(false)
  const observedEvidence = useSkillEvidence(true, settingsVersion)
  const evidence = { ...observedEvidence, snapshot: observedEvidence.snapshot?.target === settings?.target_language ? observedEvidence.snapshot : null }

  function settingsChanged(saved: Settings) {
    setSettings(saved)
    applyUiLanguage(saved.native_language)
    setSettingsVersion((v) => v + 1)
  }

  async function changeLanguage(field: 'target_language' | 'native_language', value: string) {
    if (!settings || savingLanguage || settingsOpen || settings[field] === value) return
    setSavingLanguage(true)
    try {
      const current = await getSettings()
      const saved = { ...current, [field]: value }
      if (field === 'target_language') saved.target_dialect = ''
      await saveSettings(saved)
      settingsChanged(await getSettings())
    } catch (error) {
      reportFault('Saving language', error)
    } finally {
      setSavingLanguage(false)
    }
  }
  const [showNotTauri, setShowNotTauri] = useState(!isTauri)
  // Everything that has gone wrong anywhere in the app, shown at the very top
  // of the window until dismissed. This is the only destination for a failure.
  const [faults, setFaults] = useState<Fault[]>([])
  useEffect(() => subscribeFaults(setFaults), [])

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
        setSettings(s)
        applyUiLanguage(s.native_language)

      })
      .catch((e) => reportFault('Loading settings', e))
  }, [])

  // Settings shortcut (configurable, default ctrl+,).
  useEffect(() => {
    if (!isTauri || savingLanguage) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (comboFromEvent(e) === shortcuts.settings) {
        e.preventDefault()
        if (!settingsBusy) setSettingsOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shortcuts, savingLanguage, settingsBusy])

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
    <ReadingProvider settings={settings}><div className="app">
      <UpdateBanner />
      <div className="topbar">
        {page === 'guided' && (
          <button
            type="button"
            className="hamburger"
            aria-label="Contacts"
            aria-expanded={historyOpen}
            title="Contacts"
            onClick={() => setHistoryOpen((v) => !v)}
          >
            ☰
          </button>
        )}
        <button type="button" className="wordmark app-home" aria-label="SkellySpeak home — Chat" onClick={() => { openPractice('chat'); setHistoryOpen(false); setProgressOpen(false) }}>
          <img src="/skellyspeak-logo.png" alt="" width="28" height="28" />
          <span>SKELLYSPEAK<b>·</b></span>
        </button>
        {!isMobile && <div className="tabs" aria-label="Main navigation">
          <div className={`tab-group ${page === 'guided' ? 'active' : ''}`}><button type="button" className={`tab ${page === 'guided' ? 'active' : ''}`} onClick={() => setPage('guided')}>Guided conversation</button><button type="button" className="new-chat" aria-label="New chat" disabled={!newChatAction} onClick={() => { openPractice('chat'); newChatAction?.() }}>+</button></div>
          <button type="button" className={`tab ${page === 'skills' ? 'active' : ''}`} onClick={() => { setSkillsOpened(true); setPage('skills') }}>Skill tree</button>
        </div>}
        <div className="topbar-actions">{isMobile && <button type="button" className="new-chat" aria-label="New chat" disabled={!newChatAction} onClick={() => { openPractice('chat'); newChatAction?.() }}>+</button>}
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
        {!isMobile && <button
          type="button"
          className="gear"
          onClick={() => window.location.reload()}
          aria-label="Reload app"
          title="Reload app (⌘/Ctrl+R)"
        >
          <ToolbarIcon name="reload" />
        </button>}
        <button
          type="button"
          className="gear"
          onClick={() => setSettingsOpen(true)}
          disabled={savingLanguage}
          aria-label="Settings"
          title="Settings"
        >
          <ToolbarIcon name="settings" />
        </button>
        {isMobile && <button type="button" className="gear" aria-label="More" aria-expanded={moreOpen} onClick={() => setMoreOpen(true)}>•••</button>}
        {isTauri && <button type="button" className="gear profile-trigger" aria-label="Open language profile" title={evidence.snapshot ? `${evidence.snapshot.target} · ${evidence.snapshot.profile.xp} XP` : "My language profile"} onClick={() => setProgressOpen(true)}><ToolbarIcon name="profile" />{evidence.snapshot && <span>{evidence.snapshot.profile.xp.toLocaleString()} XP</span>}</button>}
        </div>
      </div>



      {/* A paused pipeline is indistinguishable from a hung app unless something
          says so. This is that something, and it is deliberately outside the
          panel that can set it. */}


      {faults.length > 0 && (
        <div className="fault-bar" role="alert">
          <button type="button" className="btn tiny" onClick={dismissAllFaults}>Dismiss all</button>
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

        </div>
      )}

      {evidence.error && <div role="alert">{evidence.error}<button onClick={evidence.refresh}>Retry profile</button></div>}
      {progressOpen && !evidence.snapshot && <DetailDialog title="Language profile" onClose={() => setProgressOpen(false)}><p>Language evidence is not connected.</p></DetailDialog>}
      {progressOpen && evidence.snapshot && <ProgressSummary key={evidence.snapshot.target} snapshot={evidence.snapshot} onClose={() => setProgressOpen(false)} />}
      <div className="content" {...swipe}>
        {skillsOpened && <div className={`page-holder ${page === 'skills' ? '' : 'hidden'}`} aria-hidden={page !== 'skills'}>
          <PageBoundary><Suspense fallback={<p role="status">Loading skill tree…</p>}><SkillsPage evidence={evidence} onPractice={() => openPractice('chat')} /></Suspense></PageBoundary>
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
                <ActiveSurfaceContext value={page === 'guided'}><SkillEvidenceContext value={evidence}><GuidedPage onNewChatReady={registerNewChat} active={page === 'guided'} mobileSurface={mobileSurface}
                  languagePicker={settings && <><label><span>Native</span><select className="chat-language-picker" style={{ fontSize: `${13 * Math.min(1.15, (languages().find(language => language.base === settings.native_language)?.fontScale ?? 1))}px` }} aria-label="Native language" value={settings.native_language}
                    disabled={savingLanguage || settingsOpen} onChange={event => void changeLanguage('native_language', event.target.value)}>
                    {languages().filter((language, index, all) => all.findIndex(item => item.base === language.base) === index).map(language => <option lang={language.code} style={{ fontSize: `${13 * Math.min(language.fontScale, 1.15)}px` }} key={language.base} value={language.base}>{language.endonym}</option>)}
                  </select></label>
                  <label><span>Learning</span><select className="chat-language-picker" style={{ fontSize: `${13 * Math.min(1.15, (languages().find(language => language.code === settings.target_language)?.fontScale ?? 1))}px` }} aria-label="Target language"
                    value={settings.target_language} disabled={savingLanguage || settingsOpen}
                    onChange={event => void changeLanguage('target_language', event.target.value)}>
                    {languages().map(language => <option lang={language.code} style={{ fontSize: `${13 * Math.min(language.fontScale, 1.15)}px` }} key={language.code} value={language.code}>{language.endonym}</option>)}
                  </select></label>
                  {savingLanguage && <span role="status">Saving…</span>}
                  </>}
                  settingsVersion={settingsVersion}
                  historyOpen={historyOpen}
                  onHistoryOpenChange={setHistoryOpen}
                  onOpenSettings={() => setSettingsOpen(true)}
                /></SkillEvidenceContext></ActiveSurfaceContext>
              </PageBoundary>
            </div>
          </>
        )}
      </div>



      {isMobile && <nav className="mobile-nav" aria-label="Main navigation">
        {(['chat', 'panel'] as const).map(surface => <button key={surface} type="button"
          className={`mobile-nav-item ${page === 'guided' && mobileSurface === surface ? 'active' : ''}`}
          aria-current={page === 'guided' && mobileSurface === surface ? 'page' : undefined}
          onClick={() => openPractice(surface)}>{surface === 'chat' ? 'Chat · Persona' : 'Coach'}</button>)}
      </nav>}
      {moreOpen && <DetailDialog title="More" onClose={() => setMoreOpen(false)}>
        <h2>More</h2>
        <div className="more-actions">
          <button className="btn" onClick={() => { setMoreOpen(false); setSkillsOpened(true); setPage('skills') }}>Skill tree</button>
          <button className="btn" onClick={() => { setMoreOpen(false); setDevOpen(true) }}>AI activity &amp; tools</button>
          <button className="btn" onClick={() => window.location.reload()}>Reload app</button>
        </div>
      </DetailDialog>}
      <LogsOverlay open={devOpen} onOpenChange={setDevOpen} />

      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          onBusyChange={setSettingsBusy}
          // Fires on every autosave, mid-edit. It must NOT close the modal:
          // closing belongs to Close, backdrop, Escape, or Android back.
          onSettingsChanged={settingsChanged}
        />
      )}
    </div></ReadingProvider>
  )
}
