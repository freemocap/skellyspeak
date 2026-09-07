import type { SkillSnapshot } from '../../lib/skills'
import { useSkillNavigation } from '../../hooks/useSkillNavigation'
import { DetailDialog } from '../DetailDialog'

export function ProgressSummary({ snapshot, onClose }: { snapshot: SkillSnapshot; onClose: () => void }) {
  const navigation = useSkillNavigation()
  const focus = snapshot.catalog.find(node => node.id === snapshot.profile.active_focus)
  if (!focus) throw new Error('Missing practice focus')
  const selected = navigation.state.selected?.target === snapshot.target ? navigation.state.selected.skillId : focus.id
  return <DetailDialog title="Practice progress" onClose={onClose}><h2>Practice progress</h2><p className="progress-summary-total">{snapshot.profile.xp} XP</p><p>{snapshot.profile.skills.filter(skill => skill.star).length} stars · {snapshot.target}</p><p>XP includes assisted practice. Three unassisted successes earn a skill star.</p><p>Practice focus: <strong>{focus.label}</strong></p><button className="lesson-action" onClick={() => { onClose(); navigation.explore({ target: snapshot.target, skillId: selected }) }}>Explore skills</button></DetailDialog>
}
