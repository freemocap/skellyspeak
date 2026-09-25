import { useSettingsStore } from '../../state/settings/settings'
import { useState } from 'react'
import { LearnerModel } from '../../features/skills/learner/LearnerModel'
import { ProgressSummary } from '../../features/conversation/progress/ProgressSummary'
import { useNavigationStore } from '../../state/navigation/navigation'
import { useSkillEvidence } from '../../state/learning/useSkillEvidence'

/** The report loads its own overview; it is available before the shared snapshot arrives. */
export function ProfileOverlay() {
  const [learningTarget, setLearningTarget] = useState<string | null>(null)
  const { snapshot } = useSkillEvidence()
  const target = useSettingsStore(state => state.settings?.target_language)
  const open = useNavigationStore((state) => state.overlay === 'profile')
  const closeOverlay = useNavigationStore((state) => state.closeOverlay)
  if (!open) return null
  return learningTarget ? <LearnerModel key={learningTarget} target={learningTarget} onClose={() => setLearningTarget(null)} />
    : <ProgressSummary key={target} target={target} snapshot={snapshot ?? undefined} onClose={closeOverlay} onLearning={setLearningTarget} />
}
