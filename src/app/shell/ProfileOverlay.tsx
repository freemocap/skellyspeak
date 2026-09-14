import { useI18n } from '../../ui/i18n'
import { useState } from 'react'
import { LearnerModel } from '../../features/skills/LearnerModel'
import { DetailDialog } from '../../ui/DetailDialog'
import { ProgressSummary } from '../../features/guided/ProgressSummary'
import { useNavigationStore } from '../../state/navigation'
import { useSkillEvidence } from '../../state/useSkillEvidence'

/// The language profile, opened from the topbar, and the failure that stands in
/// for it when evidence is not connected.
///
/// It opens on the evidence for the active language. `ProgressSummary` then
/// presents every language to its own subtree, which is why that subtree reads a
/// different snapshot than this one.
export function ProfileOverlay() {
  const tr = useI18n()
  const [learningTarget, setLearningTarget] = useState<string | null>(null)
  const { snapshot, error, reload } = useSkillEvidence()
  const open = useNavigationStore((state) => state.overlay === 'profile')
  const closeOverlay = useNavigationStore((state) => state.closeOverlay)
  return <>
    {error && <div role="alert">{error}<button onClick={reload}>{tr("Retry profile")}</button></div>}
    {open && !snapshot && <DetailDialog title={tr("Language profile")} onClose={closeOverlay}><p>{tr("Language evidence is not connected.")}</p></DetailDialog>}
    {open && snapshot && (learningTarget ? <LearnerModel key={learningTarget} target={learningTarget} onClose={() => setLearningTarget(null)} /> : <ProgressSummary key={snapshot.target} snapshot={snapshot} onClose={closeOverlay} onLearning={setLearningTarget} />)}
  </>
}
