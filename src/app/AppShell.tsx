import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { ActiveSurfaceContext } from '../ui/useOverlayLayer'
import { useIsMobile } from '../ui/useIsMobile'
import { usePracticeSwipe } from './usePracticeSwipe'
import { SkillEvidenceContext, useSkillEvidence } from '../state/useSkillEvidence'
import { useSkillNavigation } from '../state/useSkillNavigation'
import { configureAudioVolumes } from '../platform/audio/audio-volume'
import { openOverlay } from '../domain/input/back'
import { reportFault, subscribeFaults, type Fault } from '../platform/diagnostics/faults'
import { applyFontSizeAction, type FontSizeAction } from '../domain/input/font-size'
import { uiLangFromNative } from '../domain/language/i18n'
import { SHORTCUT_DEFAULTS } from '../domain/input/keyboard'
import { getSettings, invoke, isTauri, languageFor, saveSettings } from '../platform/ipc/tauri'
import { LogsOverlay } from '../features/activity/LogsOverlay'
import { DetailDialog } from '../ui/DetailDialog'
import { ProgressSummary } from '../features/guided/ProgressSummary'
import { ReadingProvider } from '../ui/TargetText'
import { SettingsModal } from '../features/settings/SettingsModal'
import { UpdateBanner } from './shell/UpdateBanner'
import GuidedPage, { type MobileLocation } from '../features/guided/GuidedPage'
import { LearningPicker, NativePicker } from '../features/settings/LanguagePickers'
import { FaultBar } from './shell/FaultBar'
import { MobileNav } from './shell/MobileNav'
import { MoreDialog } from './shell/MoreDialog'
import { NotTauriNotice } from './shell/NotTauriNotice'
import { PageBoundary } from './shell/PageBoundary'
import { TopBar } from './shell/TopBar'
import { useReloadShortcut } from './shortcuts/useReloadShortcut'
import { useSettingsShortcut } from './shortcuts/useSettingsShortcut'
import { useTextSizeShortcut } from './shortcuts/useTextSizeShortcut'
import type { Page } from './navigation'
import type { Settings, Shortcuts } from '../types'
import type { ConnectionConfig } from '../contracts'

const SkillsPage = lazy(() => import('../features/skills/SkillsPage'))

/// Mirror the native language onto the document: UI strings come from
/// `uiLangFromNative` (domain/language/i18n) and text direction from the registry, so an
/// Arabic native gets a right-to-left UI rather than just Arabic words.
function applyUiLanguage(native: string) {
  document.documentElement.dir = languageFor(native)?.direction ?? 'ltr'
  document.documentElement.lang = uiLangFromNative(native)
}

/// The application shell: it owns the app-wide state and composes the surfaces.
/// Settings, AI access, faults, navigation and skill evidence all live here as
/// local state, deliberately — moving them into stores is a separate task.
export function AppShell() {
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
  const isMobile = useIsMobile()
  useEffect(() => isMobile && page === 'skills' ? openOverlay(() => setPage('guided')) : undefined, [isMobile, page])
  // Owned here because the control belongs beside the wordmark, while the
  // conversations it lists belong to the Guided page.
  const [historyOpen, setHistoryOpen] = useState(false)
  const swipe = usePracticeSwipe(direction => openPractice(direction === 'next' ? 'panel' : 'chat'), isMobile && page === 'guided' && !historyOpen && !moreOpen && !devOpen && !settingsOpen)
  // Bumped whenever Settings saves — pages watch it and re-fetch settings.
  const [settingsVersion, setSettingsVersion] = useState(0)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [connection, setConnection] = useState<ConnectionConfig | null>(null)
  const [startingHostedSignIn, setStartingHostedSignIn] = useState(false)
  const refreshConnection = useCallback(async () => {
    if (!isTauri) return
    setConnection(await invoke<ConnectionConfig>('get_connection'))
  }, [])
  useEffect(() => {
    if (!settings) return
    try { configureAudioVolumes(settings) }
    catch (error) { reportFault('Audio settings', error); setSettings(null) }
  }, [settings === null, settings?.master_volume, settings?.voice_volume, settings?.effects_volume])
  const [savingLanguage, setSavingLanguage] = useState(false)
  const observedEvidence = useSkillEvidence(true, settingsVersion)
  const evidence = { ...observedEvidence, snapshot: observedEvidence.snapshot?.target === settings?.target_language ? observedEvidence.snapshot : null }

  const settingsChanged = useCallback((saved: Settings) => {
    setSettings(saved)
    applyUiLanguage(saved.native_language)
    setSettingsVersion((v) => v + 1)
    void refreshConnection().catch(error => reportFault('Loading AI access', error))
  }, [refreshConnection])

  const startHostedSignIn = useCallback(async () => {
    if (startingHostedSignIn) return
    setStartingHostedSignIn(true)
    try {
      let current = await invoke<ConnectionConfig>('get_connection')
      if (current.route !== 'hosted') {
        current = await invoke<ConnectionConfig>('select_route', {
          expectedRevision: current.revision,
          route: 'hosted',
        })
      }
      await invoke('hosted_sign_in')
      setConnection(await invoke<ConnectionConfig>('get_connection'))
    } catch (error) {
      reportFault('Signing in with Google', error)
    } finally {
      setStartingHostedSignIn(false)
    }
  }, [startingHostedSignIn])

  useEffect(() => {
    let disposed = false
    const refresh = () => { void getSettings().then(fresh => { if (!disposed) settingsChanged(fresh) }).catch(error => { if (!disposed) reportFault('Loading settings', error) }) }
    window.addEventListener('skellyspeak-settings-saved', refresh)
    return () => { disposed = true; window.removeEventListener('skellyspeak-settings-saved', refresh) }
  }, [])

  useEffect(() => {
    void refreshConnection().catch(error => reportFault('Loading AI access', error))
  }, [refreshConnection])

  async function changeLanguage(field: 'target_language' | 'native_language', value: string) {
    if (!settings || savingLanguage || settingsOpen || settings[field] === value) return
    setSavingLanguage(true)
    try {
      const current = await getSettings()
      const saved = { ...current, [field]: value }
      if (field === 'target_language') saved.target_dialect = ''
      await saveSettings(saved, current)
      settingsChanged(await getSettings())
    } catch (error) {
      reportFault('Saving language', error)
    } finally {
      setSavingLanguage(false)
    }
  }
  const [showNotTauri, setShowNotTauri] = useState(!isTauri)
  const [faults, setFaults] = useState<Fault[]>([])
  useEffect(() => subscribeFaults(setFaults), [])

  // Settings are read ONCE here, and everything on this screen derives from
  // that read: one load, one owner. A second loader elsewhere would race this
  // one, and a swallowed failure here reads as a shortcut that does nothing.
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

  // Reading size is a learner preference, not transient WebView zoom. Both
  // the keyboard and the native View menu call this one path.
  const changeFontSize = useCallback((action: FontSizeAction) => {
    void (async () => {
      const current = await getSettings()
      const textSize = applyFontSizeAction(current.text_size, action)
      if (textSize === current.text_size) return
      await saveSettings({ ...current, text_size: textSize }, current)
      settingsChanged(await getSettings())
    })().catch(error => reportFault('Changing text size', error))
  }, [settingsChanged])

  const toggleSettings = useCallback(() => setSettingsOpen(open => !open), [])
  useSettingsShortcut({ enabled: isTauri && !savingLanguage, shortcut: shortcuts.settings, busy: settingsBusy, onToggle: toggleSettings })
  useTextSizeShortcut(changeFontSize)
  useReloadShortcut()

  const profile = evidence.snapshot ? { target: evidence.snapshot.target, xp: evidence.snapshot.profile.xp } : null

  return (
    <ReadingProvider settings={settings}><div className="app">
      <UpdateBanner />
      <TopBar
        page={page}
        isMobile={isMobile}
        historyOpen={historyOpen}
        devOpen={devOpen}
        moreOpen={moreOpen}
        savingLanguage={savingLanguage}
        newChatAction={newChatAction}
        profile={profile}
        onHistoryToggle={() => setHistoryOpen((v) => !v)}
        onHome={() => { openPractice('chat'); setHistoryOpen(false); setProgressOpen(false) }}
        onPage={setPage}
        onNewChat={() => { openPractice('chat'); newChatAction?.() }}
        onSkillTree={() => { setSkillsOpened(true); setPage('skills') }}
        onDevToggle={() => setDevOpen((v) => !v)}
        onOpenSettings={() => setSettingsOpen(true)}
        onMoreOpen={() => setMoreOpen(true)}
        onOpenProfile={() => setProgressOpen(true)}
      />
      <FaultBar faults={faults} />

      {evidence.error && <div role="alert">{evidence.error}<button onClick={evidence.refresh}>Retry profile</button></div>}
      {progressOpen && !evidence.snapshot && <DetailDialog title="Language profile" onClose={() => setProgressOpen(false)}><p>Language evidence is not connected.</p></DetailDialog>}
      {progressOpen && evidence.snapshot && <ProgressSummary key={evidence.snapshot.target} snapshot={evidence.snapshot} onClose={() => setProgressOpen(false)} />}
      <div className="content" {...swipe}>
        {skillsOpened && <div className={`page-holder ${page === 'skills' ? '' : 'hidden'}`} aria-hidden={page !== 'skills'}>
          <PageBoundary><Suspense fallback={<p role="status">Loading skill tree…</p>}><SkillsPage evidence={evidence} onPractice={() => openPractice('chat')} /></Suspense></PageBoundary>
        </div>}
        {showNotTauri ? (page !== 'skills' &&
          <NotTauriNotice />
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
                  learningPicker={settings && <LearningPicker settings={settings} saving={savingLanguage} disabled={settingsOpen} onChange={(field, value) => void changeLanguage(field, value)} />}
                  nativePicker={settings && <NativePicker settings={settings} saving={savingLanguage} disabled={settingsOpen} onChange={(field, value) => void changeLanguage(field, value)} />}
                  settingsVersion={settingsVersion}
                  accessConfigured={connection?.configured ?? null}
                  accessStarting={startingHostedSignIn}
                  onStartHostedSignIn={() => void startHostedSignIn()}
                  historyOpen={historyOpen}
                  onHistoryOpenChange={setHistoryOpen}
                  onOpenSettings={() => setSettingsOpen(true)}
                /></SkillEvidenceContext></ActiveSurfaceContext>
              </PageBoundary>
            </div>
          </>
        )}
      </div>

      {isMobile && <MobileNav active={page === 'guided'} surface={mobileSurface} onSurface={openPractice} />}
      {moreOpen && <MoreDialog
        onClose={() => setMoreOpen(false)}
        onSkillTree={() => { setMoreOpen(false); setSkillsOpened(true); setPage('skills') }}
        onActivity={() => { setMoreOpen(false); setDevOpen(true) }}
        onReload={() => window.location.reload()}
      />}
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
