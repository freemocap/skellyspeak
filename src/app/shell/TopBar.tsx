import { useIsMobile } from '../../ui/useIsMobile'
import { ToolbarIcon } from '../../ui/ToolbarIcon'
import { isTauri } from '../../platform/ipc/tauri'
import { useNavigationStore } from '../../state/navigation'
import { useSettingsStore } from '../../state/settings'
import { useSkillEvidence } from '../../state/useSkillEvidence'

/// The app's fixed chrome: contacts toggle, wordmark, surface tabs and the
/// action cluster.
///
/// It reads the stores rather than being handed a dozen callbacks, and owns no
/// state of its own — including the XP on the profile button, which is the
/// evidence store's value for the active language.
export function TopBar() {
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
  const showPage = useNavigationStore((state) => state.showPage)
  const openPractice = useNavigationStore((state) => state.openPractice)
  const openSkills = useNavigationStore((state) => state.openSkills)
  const showOverlay = useNavigationStore((state) => state.showOverlay)
  const toggleOverlay = useNavigationStore((state) => state.toggleOverlay)
  const newChat = () => { openPractice('chat'); newChatAction?.() }

  return (
    <div className="topbar">
      {page === 'guided' && (
        <button
          type="button"
          className="hamburger"
          aria-label="Contacts"
          aria-expanded={historyOpen}
          title="Contacts"
          onClick={toggleHistory}
        >
          ☰
        </button>
      )}
      <button type="button" className="wordmark app-home" aria-label="SkellySpeak home — Chat" onClick={goHome}>
        <img src="/skellyspeak-logo.png" alt="" width="28" height="28" />
        <span>SKELLYSPEAK<b>·</b></span>
      </button>
      {!isMobile && <div className="tabs" aria-label="Main navigation">
        <div className={`tab-group ${page === 'guided' ? 'active' : ''}`}><button type="button" className={`tab ${page === 'guided' ? 'active' : ''}`} onClick={() => showPage('guided')}>Guided conversation</button><button type="button" className="new-chat" aria-label="New chat" disabled={!newChatAction} onClick={newChat}>+</button></div>
        <button type="button" className={`tab ${page === 'skills' ? 'active' : ''}`} onClick={openSkills}>Skill tree</button>
      </div>}
      <div className="topbar-actions">{isMobile && <button type="button" className="new-chat" aria-label="New chat" disabled={!newChatAction} onClick={newChat}>+</button>}
      {!isMobile && (
        <button
          type="button"
          className={`inside-btn ${overlay === 'activity' ? 'open' : ''}`}
          onClick={() => toggleOverlay('activity')}
          aria-label="AI"
          aria-expanded={overlay === 'activity'}
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
        onClick={() => showOverlay('settings')}
        disabled={savingLanguage}
        aria-label="Settings"
        title="Settings"
      >
        <ToolbarIcon name="settings" />
      </button>
      {isMobile && <button type="button" className="gear" aria-label="More" aria-expanded={overlay === 'more'} onClick={() => showOverlay('more')}>•••</button>}
      {isTauri && <button type="button" className="gear profile-trigger" aria-label="Open language profile" title={profile ? `${profile.target} · ${profile.xp} XP` : "My language profile"} onClick={() => showOverlay('profile')}><ToolbarIcon name="profile" />{profile && <span>{profile.xp.toLocaleString()} XP</span>}</button>}
      </div>
    </div>
  )
}
