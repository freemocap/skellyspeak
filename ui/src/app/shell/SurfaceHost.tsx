import { useI18n } from '../../components/localization/i18n'
import { lazy, Suspense } from 'react'
import { ActiveSurfaceContext } from '../../components/dialogs/useOverlayLayer'
import { SkillEvidenceContext, useSkillEvidence } from '../../state/learning/useSkillEvidence'
import { useNavigationStore } from '../../state/navigation/navigation'
import { isTauri } from '../../platform/ipc/tauri'
import ConversationPage from '../../features/conversation/ConversationPage'
import { NativePicker } from '../../features/settings/language/LanguagePickers'
import { usePracticeSwipe } from '../navigation/usePracticeSwipe'
import { NotTauriNotice } from './NotTauriNotice'
import { PageBoundary } from './PageBoundary'

const SkillsPage = lazy(() => import('../../features/skills/SkillsPage'))
const DrillPage = lazy(() => import('../../features/drill/DrillPage'))

/// Which surface is on screen, and how it is mounted.
///
/// Both surfaces stay MOUNTED once shown and are hidden with CSS rather than
/// unmounted: unmounting the conversation on a tab switch destroyed it. That rule
/// lives here with the markup it governs.
export function SurfaceHost() {
  const tr = useI18n()
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
  const practiceView = useNavigationStore((state) => state.practiceView)
  // Drill replaces the conversation rather than sitting beside it, and is
  // mounted only once it has been asked for.
  const drilling = page === 'guided' && practiceView === 'drill'

  // Swiping between the halves is only meaningful with nothing over them.
  const swipe = usePracticeSwipe(
    direction => useNavigationStore.getState().openPractice(direction === 'next' ? 'panel' : 'chat'),
    page === 'guided' && !historyOpen && overlay === null,
  )

  return (
    <div className="content" {...swipe}>
      {skillsOpened && <div className={`page-holder ${page === 'skills' ? '' : 'hidden'}`} aria-hidden={page !== 'skills'}>
        <PageBoundary><Suspense fallback={<p role="status">{tr("Loading skill tree…")}</p>}><SkillsPage onPractice={() => openPractice('chat')} /></Suspense></PageBoundary>
      </div>}
      {!isTauri ? (page !== 'skills' &&
        <NotTauriNotice />
      ) : (
        <div className={`page-holder ${page === 'guided' ? '' : 'hidden'}`} aria-hidden={page !== 'guided'}>
          {drilling ? <PageBoundary>
            <Suspense fallback={<p role="status">{tr("Loading drill…")}</p>}><DrillPage active /></Suspense>
          </PageBoundary> : <PageBoundary>
            <ActiveSurfaceContext value={page === 'guided' && !drilling}><SkillEvidenceContext value={evidence}><ConversationPage active={page === 'guided' && !drilling} mobileSurface={mobileSurface}
              nativePicker={<NativePicker />}
              historyOpen={historyOpen}
              onHistoryOpenChange={setHistoryOpen}
              onOpenSettings={() => showOverlay('settings')}
              onNewChatReady={registerNewChat}
            /></SkillEvidenceContext></ActiveSurfaceContext>
          </PageBoundary>}
        </div>
      )}
    </div>
  )
}
