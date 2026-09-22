import { XpEvidenceReport } from './XpEvidenceReport'
import { useContext, useState } from 'react'
import { SkillEvidenceContext } from '../../../state/learning/useSkillEvidence'
import { PracticeContext } from '../session/PracticeContext'
import { RewardInspectionContext } from './RewardInspectionContext'
import { SkillList } from '../../../components/learning/SkillList'

/** Conversation skill list shares the language-wide totals and reward destinations. */
export function ConversationMap() {
  const { snapshot } = useContext(SkillEvidenceContext)
  const practice = useContext(PracticeContext)
  const [inspected, setInspected] = useState<string | null>(null)
  const rewards = useContext(RewardInspectionContext)
  if (!snapshot || !practice) return null
  return <><SkillList key={snapshot.target} snapshot={snapshot} selected={practice.selected ?? undefined} onSelect={id => { practice.select(id); setInspected(id) }} presenting={rewards?.presenting ?? false} />
    {inspected && <XpEvidenceReport snapshot={snapshot} skillId={inspected} onClose={() => setInspected(null)} />}
  </>
}
