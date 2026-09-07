import { skillTree } from '../pages/skillTree'
import type { SkillSnapshot } from './skills'
/** Browser-only fixture. Native mode never substitutes this for a failed load. */
export const skillDemo: SkillSnapshot = {
  catalog: skillTree, catalog_version: 3, learner_id: 'demo', target: 'es-ES', conversation_count: 0, records: [],
  profile: {
    rules_version: 1, choices: { version: 1, revision: 0, learner_id: 'demo', target: 'es-ES', focus: null, excluded_attempts: [] },
    xp: 0, recommended_focus: 'referent', active_focus: 'referent',
    skills: skillTree.filter((s) => s.kind === 'skill').map((s) => ({ skill_id: s.id, successes: 0, assisted: 0, xp: 0, checked: false, star: false })),
    branches: skillTree.filter((s) => s.kind === 'skill').map((s) => ({ skill_id: s.id, available: skillTree.some((parent) => parent.id === s.parent && parent.kind === 'domain') })),
  },
}
