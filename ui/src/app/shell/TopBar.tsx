import { useI18n } from '../../components/localization/i18n'
import { useIsMobile } from '../../components/layout/useIsMobile'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { isTauri } from '../../platform/ipc/tauri'
import { useNavigationStore } from '../../state/navigation/navigation'
import { useSettingsStore } from '../../state/settings/settings'
import { useSkillEvidence } from '../../state/learning/useSkillEvidence'

/// The app's fixed chrome: contacts toggle, wordmark, surface tabs and the
/// action cluster.
///
/// It reads the stores rather than being handed a dozen callbacks, and owns no
/// state of its own — including the XP on the profile button, which is the
/// evidence store's value for the active language.
export function TopBar() {
  const tr = useI18n()
  const evidence = useSkillEvidence()
  // A summary of the language profile: which language, and its XP. There is
  // nothing to show until evidence for the active language has landed.
  const profile = evidence.snapshot ? { target: evidence.snapshot.target, xp: evidence.snapshot.profile.xp } : null
  const savingLanguage = useSettingsStore((state) => state.savingLanguage)
  const newChatAction = useNavigationStore((state) => state.newChatAction)
  const isMobile = useIsMobile()
  const page = useNavigationStore((state) => state.page)
  const historyOpen = useNavigationStore((state) => state.historyOpen)
  const overlay = useNavigationStore((state) => state.overlay)
  const toggleHistory = useNavigationStore((state) => state.toggleHistory)
  const goHome = useNavigationStore((state) => state.goHome)
  const mode = useNavigationStore((state) => state.mode)
  const setMode = useNavigationStore((state) => state.setMode)
  const openPractice = useNavigationStore((state) => state.openPractice)
  const showOverlay = useNavigationStore((state) => state.showOverlay)
  const toggleOverlay = useNavigationStore((state) => state.toggleOverlay)
  const newChat = () => { openPractice('chat'); newChatAction?.() }

  return (
    <div className="topbar">
      {page === 'guided' && (
        <button
          type="button"
          className="hamburger"
          aria-label={tr("Contacts")}
          aria-expanded={historyOpen}
          title={tr("Contacts")}
          onClick={toggleHistory}
        >
          ☰
        </button>
      )}
      <button type="button" className="wordmark app-home" aria-label={tr("SkellySpeak home — Chat")} onClick={goHome}>
        <img src="/skellyspeak-logo.png" alt="" width="28" height="28" />
        <span>SKELLYSPEAK<b>·</b></span>
      </button>
      {!isMobile && <nav className="workspace-modes" aria-label={tr("Main navigation")}>
        {(['practice', 'learn', 'review'] as const).map(item => <button key={item} data-mode={item} type="button" aria-current={mode === item ? 'page' : undefined} onClick={() => setMode(item)}>{tr(item === 'practice' ? 'Practice' : item === 'learn' ? 'Learn' : 'Review')}</button>)}
      </nav>}
      <div className="topbar-actions">
      <button
        type="button"
        className={isMobile ? 'new-chat' : 'btn'}
        aria-label={tr("New conversation")}
        title={tr("New conversation")}
        disabled={!newChatAction}
        onClick={newChat}
      >{isMobile ? '+' : tr("New conversation")}</button>
      {!isMobile && (
        <button
          type="button"
          className={`inside-btn ${overlay === 'activity' ? 'open' : ''}`}
          onClick={() => toggleOverlay('activity')}
          aria-label="AI"
          aria-expanded={overlay === 'activity'}
          title={tr("AI — understand recent activity, inspect a pipeline, or open debugging tools")}
        >
          <span className="inside-dot" aria-hidden="true" />
          AI
        </button>
      )}
      {!isMobile && <button
        type="button"
        className="gear"
        onClick={() => window.location.reload()}
        aria-label={tr("Reload app")}
        title={tr("Reload app (⌘/Ctrl+R)")}
      >
        <ToolbarIcon name="reload" />
      </button>}
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
      {isMobile && <button type="button" className="gear" aria-label={tr("More")} aria-expanded={overlay === 'more'} onClick={() => showOverlay('more')}>•••</button>}
      {isTauri && <button type="button" className="gear profile-trigger" aria-label={tr("Open language profile")} title={profile ? tr("{value0} · {value1} XP", { value0: String(profile.target), value1: String(profile.xp) }) : tr("My language profile")} onClick={() => showOverlay('profile')}><ToolbarIcon name="profile" />{profile && <span>{profile.xp.toLocaleString(tr.locale)} {tr(" XP")}</span>}</button>}
      </div>
    </div>
  )
}
