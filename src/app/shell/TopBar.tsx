import { isTauri } from '../../platform/ipc/tauri'
import { ToolbarIcon } from '../../ui/ToolbarIcon'
import type { Page } from '../navigation'

/// The app's fixed chrome: contacts toggle, wordmark, surface tabs and the
/// action cluster. It owns no state — every control reports upward, because the
/// same values are read by the pages below.
export function TopBar({ page, isMobile, historyOpen, devOpen, moreOpen, savingLanguage, newChatAction, profile, onHistoryToggle, onHome, onPage, onNewChat, onSkillTree, onDevToggle, onOpenSettings, onMoreOpen, onOpenProfile }: {
  page: Page
  isMobile: boolean
  historyOpen: boolean
  devOpen: boolean
  moreOpen: boolean
  savingLanguage: boolean
  newChatAction: (() => void) | null
  /// The language profile the button opens, or null when evidence is not loaded.
  profile: { target: string; xp: number } | null
  onHistoryToggle: () => void
  onHome: () => void
  onPage: (page: Page) => void
  onNewChat: () => void
  onSkillTree: () => void
  onDevToggle: () => void
  onOpenSettings: () => void
  onMoreOpen: () => void
  onOpenProfile: () => void
}) {
  return (
    <div className="topbar">
      {page === 'guided' && (
        <button
          type="button"
          className="hamburger"
          aria-label="Contacts"
          aria-expanded={historyOpen}
          title="Contacts"
          onClick={onHistoryToggle}
        >
          ☰
        </button>
      )}
      <button type="button" className="wordmark app-home" aria-label="SkellySpeak home — Chat" onClick={onHome}>
        <img src="/skellyspeak-logo.png" alt="" width="28" height="28" />
        <span>SKELLYSPEAK<b>·</b></span>
      </button>
      {!isMobile && <div className="tabs" aria-label="Main navigation">
        <div className={`tab-group ${page === 'guided' ? 'active' : ''}`}><button type="button" className={`tab ${page === 'guided' ? 'active' : ''}`} onClick={() => onPage('guided')}>Guided conversation</button><button type="button" className="new-chat" aria-label="New chat" disabled={!newChatAction} onClick={onNewChat}>+</button></div>
        <button type="button" className={`tab ${page === 'skills' ? 'active' : ''}`} onClick={onSkillTree}>Skill tree</button>
      </div>}
      <div className="topbar-actions">{isMobile && <button type="button" className="new-chat" aria-label="New chat" disabled={!newChatAction} onClick={onNewChat}>+</button>}
      {!isMobile && (
        <button
          type="button"
          className={`inside-btn ${devOpen ? 'open' : ''}`}
          onClick={onDevToggle}
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
        onClick={onOpenSettings}
        disabled={savingLanguage}
        aria-label="Settings"
        title="Settings"
      >
        <ToolbarIcon name="settings" />
      </button>
      {isMobile && <button type="button" className="gear" aria-label="More" aria-expanded={moreOpen} onClick={onMoreOpen}>•••</button>}
      {isTauri && <button type="button" className="gear profile-trigger" aria-label="Open language profile" title={profile ? `${profile.target} · ${profile.xp} XP` : "My language profile"} onClick={onOpenProfile}><ToolbarIcon name="profile" />{profile && <span>{profile.xp.toLocaleString()} XP</span>}</button>}
      </div>
    </div>
  )
}
