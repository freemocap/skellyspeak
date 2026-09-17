import type { ReactNode } from 'react'
import { LearningPicker } from '../../features/settings/language/LanguagePickers'
import { useI18n } from '../../components/localization/i18n'
import { useConnectionHealth } from '../../state/session/connection-health'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { useSessionStore } from '../../state/session/session'
import { useNavigationStore } from '../../state/navigation/navigation'
import { useSettingsStore } from '../../state/settings/settings'
import { useSkillEvidence } from '../../state/learning/useSkillEvidence'

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
  const historyOpen = useNavigationStore((state) => state.historyOpen)
  const overlay = useNavigationStore((state) => state.overlay)
  const toggleHistory = useNavigationStore((state) => state.toggleHistory)
  const goHome = useNavigationStore((state) => state.goHome)
  const showOverlay = useNavigationStore((state) => state.showOverlay)

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
      <div className="topbar-actions">
      <button type="button" className="profile-trigger" aria-label={tr("Open language profile")} onClick={() => showOverlay('profile')}><span className="profile-star"><ToolbarIcon name="star" size={16} /></span>{profile ? <><strong>{profile.xp.toLocaleString(tr.browserLocale)} XP</strong><span className="profile-meter" aria-hidden="true"><span style={{ width: `${(profile.xp % 50) * 2}%` }} /></span></> : tr("Progress")}</button>
      <button type="button" className="connection-state connection-setup" data-configured={Boolean(connected)}
        aria-busy={checking} title={connectionDetail} onClick={() => showOverlay('settings')}>
        {connected ? tr('AI Connected') : tr('AI Not Connected')}
      </button>

      <button
        type="button"
        className="gear"
        onClick={() => showOverlay('settings')}
        disabled={savingLanguage}
        aria-label={tr("Settings")}
        title={tr("Settings")}
      >
        <ToolbarIcon name="settings" />
      </button>
      <button type="button" className="gear" aria-label={tr("More")} aria-expanded={overlay === 'more'} onClick={() => showOverlay('more')}><ToolbarIcon name="more" size={18} /></button>

      </div>
    </div>
  )
}
