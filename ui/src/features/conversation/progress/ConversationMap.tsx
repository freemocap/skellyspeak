import { useContext } from 'react'
import { PracticeContext } from '../session/PracticeContext'
import { SkillLevelsPanel } from '../../../components/learning/SkillLevelsPanel'
import { conversationSkillPoints } from '../../../domain/learning/statistics/skill-levels'
import { useSkillNavigationStore } from '../../../state/navigation/skill-navigation'
import type { SkillSnapshot } from '../../../domain/learning/evidence/skills'

/** The language's skill levels with this conversation's points drawn over them.
 * The selected skill's "<skill> in <language>" button opens it on the Progress
 * page, the same page the Progress destination shows; "Use this in a <language>
 * conversation" picks it as this conversation's practice skill. */
export function ConversationMap({ languageSnapshot, languageName, chatId }: { languageSnapshot: SkillSnapshot; languageName: string; chatId: string }) {
  const practice = useContext(PracticeContext)
  const explore = useSkillNavigationStore(state => state.explore)
  if (!practice) throw new Error('ConversationMap needs a practice context.')
  return <SkillLevelsPanel key={`${languageSnapshot.target}:${chatId}`} snapshot={languageSnapshot} languageName={languageName} conversation={conversationSkillPoints(languageSnapshot, chatId)}
    onInspect={skillId => explore({ target: languageSnapshot.target, skillId })} onPractice={practice.select} practiceSkill={practice.selected ?? languageSnapshot.profile.active_focus} />
}
