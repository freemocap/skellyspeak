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
import { ReturnStrip } from './ReturnStrip'

const SkillsPage = lazy(() => import('../../features/skills/SkillsPage'))
const DrillPage = lazy(() => import('../../features/drill/DrillPage'))

/// Which surface is on screen, and how it is mounted.
///
/// Every surface stays MOUNTED once shown and is hidden with CSS rather than
/// unmounted: the conversation keeps its draft, scroll position and coach panel
/// while the learner is in Practice or Skills. The two destinations carry a
/// return strip back to the conversation. That rule lives here with the markup
/// it governs.
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
  const openConversation = useNavigationStore((state) => state.openConversation)
  const registerNewChat = useNavigationStore((state) => state.registerNewChat)
  const practiceView = useNavigationStore((state) => state.practiceView)
  const drillOpened = useNavigationStore((state) => state.drillOpened)
  // Practice takes the conversation's place on screen while it shows; the
  // conversation stays mounted underneath. Practice itself is mounted only once
  // it has been asked for.
  const drilling = page === 'guided' && practiceView === 'drill'
  const conversing = page === 'guided' && !drilling

  // Swiping between the halves is only meaningful with nothing over them.
  const swipe = usePracticeSwipe(
    direction => useNavigationStore.getState().openConversation(direction === 'next' ? 'panel' : 'chat'),
    page === 'guided' && !drilling && !historyOpen && overlay === null,
  )

  return (
    <div className="content" {...swipe}>
      {skillsOpened && <div className={`page-holder destination-page ${page === 'skills' ? '' : 'hidden'}`} aria-hidden={page !== 'skills'}>
        <ReturnStrip />
        <ActiveSurfaceContext value={page === 'skills'}><PageBoundary><Suspense fallback={<p role="status">{tr("Loading skill tree…")}</p>}><SkillsPage onPractice={() => openConversation('chat')} /></Suspense></PageBoundary></ActiveSurfaceContext>
      </div>}
      {!isTauri ? (page !== 'skills' &&
        <NotTauriNotice />
      ) : (<>
        {drillOpened && <div className={`page-holder destination-page ${drilling ? '' : 'hidden'}`} aria-hidden={!drilling}>
          <ReturnStrip />
          <ActiveSurfaceContext value={drilling}><PageBoundary>
            <Suspense fallback={<p role="status">{tr("Loading Practice…")}</p>}><DrillPage active={drilling} /></Suspense>
          </PageBoundary></ActiveSurfaceContext>
        </div>}
        <div className={`page-holder ${conversing ? '' : 'hidden'}`} aria-hidden={!conversing}>
          <PageBoundary>
            <ActiveSurfaceContext value={conversing}><SkillEvidenceContext value={evidence}><ConversationPage active={conversing} mobileSurface={mobileSurface}
              nativePicker={<NativePicker />}
              historyOpen={historyOpen}
              onHistoryOpenChange={setHistoryOpen}
              onOpenSettings={() => showOverlay('settings')}
              onNewChatReady={registerNewChat}
            /></SkillEvidenceContext></ActiveSurfaceContext>
          </PageBoundary>
        </div>
      </>)}
    </div>
  )
}
