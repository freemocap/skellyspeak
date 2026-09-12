import { lazy, Suspense } from 'react'
import { ActiveSurfaceContext } from '../../ui/useOverlayLayer'
import { SkillEvidenceContext, useSkillEvidence } from '../../state/useSkillEvidence'
import { useNavigationStore } from '../../state/navigation'
import { isTauri } from '../../platform/ipc/tauri'
import GuidedPage from '../../features/guided/GuidedPage'
import { LearningPicker, NativePicker } from '../../features/settings/LanguagePickers'
import { usePracticeSwipe } from '../usePracticeSwipe'
import { NotTauriNotice } from './NotTauriNotice'
import { PageBoundary } from './PageBoundary'

const SkillsPage = lazy(() => import('../../features/skills/SkillsPage'))

/// Which surface is on screen, and how it is mounted.
///
/// Both surfaces stay MOUNTED once shown and are hidden with CSS rather than
/// unmounted: unmounting the conversation on a tab switch destroyed it. That rule
/// lives here with the markup it governs.
export function SurfaceHost() {
  const evidence = useSkillEvidence()
  const page = useNavigationStore((state) => state.page)
  const mobileSurface = useNavigationStore((state) => state.mobileSurface)
  const skillsOpened = useNavigationStore((state) => state.skillsOpened)
  const historyOpen = useNavigationStore((state) => state.historyOpen)
  const overlay = useNavigationStore((state) => state.overlay)
  const setHistoryOpen = useNavigationStore((state) => state.setHistoryOpen)
  const showOverlay = useNavigationStore((state) => state.showOverlay)
  const openPractice = useNavigationStore((state) => state.openPractice)
  const registerNewChat = useNavigationStore((state) => state.registerNewChat)

  // Swiping between the halves is only meaningful with nothing over them.
  const swipe = usePracticeSwipe(
    direction => useNavigationStore.getState().openPractice(direction === 'next' ? 'panel' : 'chat'),
    page === 'guided' && !historyOpen && overlay === null,
  )

  return (
    <div className="content" {...swipe}>
      {skillsOpened && <div className={`page-holder ${page === 'skills' ? '' : 'hidden'}`} aria-hidden={page !== 'skills'}>
        <PageBoundary><Suspense fallback={<p role="status">Loading skill tree…</p>}><SkillsPage onPractice={() => openPractice('chat')} /></Suspense></PageBoundary>
      </div>}
      {!isTauri ? (page !== 'skills' &&
        <NotTauriNotice />
      ) : (
        <div className={`page-holder ${page === 'guided' ? '' : 'hidden'}`} aria-hidden={page !== 'guided'}>
          <PageBoundary>
            <ActiveSurfaceContext value={page === 'guided'}><SkillEvidenceContext value={evidence}><GuidedPage active={page === 'guided'} mobileSurface={mobileSurface}
              learningPicker={<LearningPicker />}
              nativePicker={<NativePicker />}
              historyOpen={historyOpen}
              onHistoryOpenChange={setHistoryOpen}
              onOpenSettings={() => showOverlay('settings')}
              onNewChatReady={registerNewChat}
            /></SkillEvidenceContext></ActiveSurfaceContext>
          </PageBoundary>
        </div>
      )}
    </div>
  )
}
