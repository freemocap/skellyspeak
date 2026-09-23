import { useSystemDark } from '../../platform/appearance/useSystemDark'
import type { ReactNode } from 'react'
import { LearningPicker } from '../../features/settings/language/LanguagePickers'
import { useI18n } from '../../components/localization/i18n'
import { useConnectionHealth } from '../../state/session/connection-health'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { useSessionStore } from '../../state/session/session'
import { useNavigationStore } from '../../state/navigation/navigation'
import { useSettingsStore } from '../../state/settings/settings'
import { useSkillEvidence } from '../../state/learning/useSkillEvidence'
import { useAiWindowStore } from '../../state/navigation/ai-window'
import { useAiBusyStore } from '../../state/session/ai-busy'
import { openAiWindow } from '../../platform/ipc/window'
import { reportFault } from '../../platform/diagnostics/faults'

/** Global language and history navigation. The injected picker supports the local
 * layout fixture; production selection uses the shared settings writer. */
export function TopBar({ languagePicker = <LearningPicker /> }: { languagePicker?: ReactNode }) {
  const tr = useI18n()
  const evidence = useSkillEvidence()
  // A summary of the language profile: which language, and its XP. There is
  // nothing to show until evidence for the active language has landed.
  const profile = evidence.snapshot ? { target: evidence.snapshot.target, xp: evidence.snapshot.profile.xp } : null
  const savingLanguage = useSettingsStore((state) => state.savingLanguage)
  const connection = useSessionStore(state => state.connection)
  const health = useConnectionHealth(state => connection ? state.routes[connection.route] : undefined)
  const connected = connection?.configured && health?.revision === connection.revision && health.status === 'connected'
  const checking = health?.revision === connection?.revision && health?.status === 'checking'
  const connectionDetail = checking ? tr('Checking AI connection…') : health?.revision === connection?.revision && health?.error
    ? health.error : health?.revision === connection?.revision && health?.checkedAt ? `${tr('Last checked')}: ${tr.dateTime(health.checkedAt)}` : tr('Connection not checked yet')
  const openPractice = useNavigationStore((state) => state.openPractice)
  const page = useNavigationStore((state) => state.page)
  const practiceSurface = useNavigationStore((state) => state.practiceView)
  const setPracticeView = useNavigationStore((state) => state.setPracticeView)
  const historyOpen = useNavigationStore((state) => state.historyOpen)
  const overlay = useNavigationStore((state) => state.overlay)
  const toggleHistory = useNavigationStore((state) => state.toggleHistory)
  const goHome = useNavigationStore((state) => state.goHome)
  const showOverlay = useNavigationStore((state) => state.showOverlay)
  const toggleOverlay = useNavigationStore((state) => state.toggleOverlay)
  const aiWindowOpen = useAiWindowStore((state) => state.open)
  const aiBusy = useAiBusyStore((state) => state.busy)
  // Connected: the button shows what the AI is doing (the AI View). Not
  // connected: it leads to AI access, where the connection is fixed.
  const openAiView = () => {
    if (!connected) { showOverlay('settings'); return }
    if (aiWindowOpen) { openAiWindow().catch(error => reportFault('Focusing the AI window', error)); return }
    toggleOverlay('activity')
  }
  // The theme the page is showing now: "system" resolves through the OS
  // preference, and the toggle flips what the learner sees.
  const theme = useSettingsStore((state) => state.settings?.theme ?? 'light')
  const systemDark = useSystemDark()
  const dark = theme === 'dark' || (theme === 'system' && systemDark)
  const toggleTheme = () => void useSettingsStore.getState().update(current => ({ ...current, theme: dark ? 'light' : 'dark' }), 'Saving theme')

  return (
    <div className="topbar">
        <button
          type="button"
          className="hamburger"
          aria-label={tr("Conversations")}
          aria-expanded={historyOpen}
          title={tr("Conversations")}
          onClick={() => { openPractice('chat'); toggleHistory() }}
        >
          <ToolbarIcon name="menu" size={18} /> <span>{tr("Conversations")}</span>
        </button>
      <button type="button" className="wordmark app-home" aria-label={tr("SkellySpeak home — Chat")} onClick={goHome}>
        <img src="/skellyspeak-logo.png" alt="" width="28" height="28" />
        <span>SkellySpeak</span>
      </button>
      <div className="topbar-language">{languagePicker}</div>
      <div className="practice-switch" role="group" aria-label={tr("Practice surface")}>
        {(['chat', 'drill'] as const).map(view => (
          <button key={view} type="button" aria-pressed={practiceSurface === view && page === 'guided'}
            onClick={() => setPracticeView(view)}>
            <ToolbarIcon name={view === 'chat' ? 'chat' : 'mic'} size={18} />{view === 'chat' ? tr("Chat") : tr("Drill")}
          </button>
        ))}
      </div>
      <div className="topbar-actions">
      <button type="button" className="profile-trigger" aria-label={tr("Open language profile")} onClick={() => showOverlay('profile')}><span className="profile-star"><ToolbarIcon name="star" size={16} /></span>{profile ? <><strong>{profile.xp.toLocaleString(tr.browserLocale)} XP</strong><span className="profile-meter" aria-hidden="true"><span style={{ width: `${(profile.xp % 50) * 2}%` }} /></span></> : tr("Progress")}</button>
      <button type="button" className="connection-state connection-setup" data-configured={Boolean(connected)}
        aria-busy={checking} aria-label={connected ? tr('AI Connected') : tr('AI Not Connected')} title={connectionDetail} onClick={openAiView}
        aria-expanded={connected ? overlay === 'activity' || aiWindowOpen : undefined} aria-controls={connected ? 'ai-activity' : undefined} data-busy={connected && aiBusy ? true : undefined}>
        <span className="connection-label">{connected ? tr('AI Connected') : tr('AI Not Connected')}</span>
      </button>

      <button type="button" className="gear theme-toggle" onClick={toggleTheme}
        aria-label={dark ? tr("Switch to light mode") : tr("Switch to dark mode")} title={dark ? tr("Switch to light mode") : tr("Switch to dark mode")}>
        <ToolbarIcon name={dark ? 'sun' : 'moon'} />
      </button>
      {/* App-wide settings. The conversation's own settings open from the chat
          header, so this one carries its name to keep the two apart. On a
          phone it moves into More, where there is room for its label. */}
      <button
        type="button"
        className="gear app-settings"
        onClick={() => showOverlay('settings')}
        disabled={savingLanguage}
        aria-label={tr("Settings")}
        title={tr("Settings")}
      >
        <ToolbarIcon name="cog" /><span>{tr("Settings")}</span>
      </button>
      <button type="button" className="gear" aria-label={tr("More")} aria-expanded={overlay === 'more'} onClick={() => showOverlay('more')}><ToolbarIcon name="more" size={18} /></button>

      </div>
    </div>
  )
}
