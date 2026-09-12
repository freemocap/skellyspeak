import { useEffect } from 'react'
import { useIsMobile } from '../ui/useIsMobile'
import { useLoadSkillEvidence } from '../state/useSkillEvidence'
import { useSkillNavigationStore } from '../state/skill-navigation'
import { useNavigationStore } from '../state/navigation'
import { useSettingsStore } from '../state/settings'
import { useSessionStore } from '../state/session'
import { openOverlay } from '../domain/input/back'
import { reportFault } from '../platform/diagnostics/faults'
import { SHORTCUT_DEFAULTS } from '../domain/input/keyboard'
import { LogsOverlay } from '../features/activity/LogsOverlay'
import { ReadingProvider } from '../ui/TargetText'
import { SettingsModal } from '../features/settings/SettingsModal'
import { UpdateBanner } from './shell/UpdateBanner'
import { FaultBar } from './shell/FaultBar'
import { MobileNav } from './shell/MobileNav'
import { MoreDialog } from './shell/MoreDialog'
import { ProfileOverlay } from './shell/ProfileOverlay'
import { SurfaceHost } from './shell/SurfaceHost'
import { TopBar } from './shell/TopBar'
import { useAppShortcuts } from './shortcuts/useAppShortcuts'

/// The application shell: the effects that belong to the application rather than
/// to a surface, plus the composition itself.
///
/// Every value below is read straight from a store with a selector, so nothing
/// is copied into component state and nothing can go stale behind a store update.
export function AppShell() {
  const page = useNavigationStore((state) => state.page)
  const overlay = useNavigationStore((state) => state.overlay)
  const showOverlay = useNavigationStore((state) => state.showOverlay)
  const closeOverlay = useNavigationStore((state) => state.closeOverlay)
  const setSettingsBusy = useNavigationStore((state) => state.setSettingsBusy)

  const settings = useSettingsStore((state) => state.settings)
  // Bumped when a settings **write** lands. The first read is not a write.
  const settingsVersion = useSettingsStore((state) => state.revision)
  // Derived, not copied: editing the shortcut in Settings takes effect at once
  // rather than at the next start.
  const shortcuts = useSettingsStore((state) => state.settings?.shortcuts ?? SHORTCUT_DEFAULTS)

  // A skill-map request from anywhere opens the tree.
  const mapRequest = useSkillNavigationStore((state) => state.mapRequest)
  useEffect(() => { if (mapRequest) useNavigationStore.getState().openSkills() }, [mapRequest])
  // Android back returns the narrow-window skill tree to the conversation.
  const isMobile = useIsMobile()
  useEffect(() => isMobile && page === 'skills' ? openOverlay(() => useNavigationStore.getState().showPage('guided')) : undefined, [isMobile, page])
  // A settings write can move the AI access projection with it.
  useEffect(() => {
    if (settingsVersion === 0) return
    void useSessionStore.getState().refresh().catch((error: unknown) => reportFault('Loading AI access', error))
  }, [settingsVersion])

  // Keep evidence read for the active language. The surfaces read the store
  // themselves, so the shell only has to say which language is current.
  useLoadSkillEvidence()
  useAppShortcuts(shortcuts)

  return (
    <ReadingProvider settings={settings}><div className="app">
      <UpdateBanner />
      <TopBar />
      <FaultBar />
      <ProfileOverlay />
      <SurfaceHost />
      <MobileNav />
      <MoreDialog />
      <LogsOverlay open={overlay === 'activity'} onOpenChange={open => open ? showOverlay('activity') : closeOverlay()} />
      {overlay === 'settings' && <SettingsModal onClose={closeOverlay} onBusyChange={setSettingsBusy} />}
    </div></ReadingProvider>
  )
}
