import { XpEvidenceReport } from './XpEvidenceReport'
import { useContext, useState } from 'react'
import { SkillEvidenceContext } from '../../../state/learning/useSkillEvidence'
import { PracticeContext } from '../session/PracticeContext'
import { RewardInspectionContext } from './RewardInspectionContext'
import { SkillList } from '../../../components/learning/SkillList'
import { SkillLevelsPanel } from '../../../components/learning/SkillLevelsPanel'
import { conversationSkillPoints } from '../../../domain/learning/statistics/skill-levels'
import type { SkillSnapshot } from '../../../domain/learning/evidence/skills'

/** Conversation skill list shares the language-wide totals and reward destinations. */
export function ConversationMap({ languageSnapshot }: { languageSnapshot?: SkillSnapshot }) {
  const { snapshot } = useContext(SkillEvidenceContext)
  const practice = useContext(PracticeContext)
  const [inspected, setInspected] = useState<string | null>(null)
  const rewards = useContext(RewardInspectionContext)
  if (!snapshot || !practice) return null
  return <>{languageSnapshot && practice.chatId
    ? <SkillLevelsPanel key={`${languageSnapshot.target}:${practice.chatId}`} snapshot={languageSnapshot} conversation={conversationSkillPoints(languageSnapshot, practice.chatId)} onInspect={setInspected} onPractice={practice.select} practiceSkill={practice.selected ?? snapshot.profile.active_focus} />
    : <SkillList key={snapshot.target} snapshot={snapshot} selected={practice.selected ?? undefined} onSelect={id => { practice.select(id); setInspected(id) }} presenting={rewards?.presenting ?? false} />}
    {inspected && <XpEvidenceReport snapshot={snapshot} skillId={inspected} onClose={() => setInspected(null)} />}
  </>
}
