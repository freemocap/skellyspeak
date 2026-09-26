import { invoke } from '@tauri-apps/api/core'
import type { SkillSnapshot } from '../../domain/learning/evidence/skills'
export interface LearnerProfile {
  evidence: SkillSnapshot
  partners: { personaId: string; name: string; archived: boolean }[]
  scope: { languageId: string; personaId: string | null }
}
export const getLearnerProfile = (target: string, personaId: string | null = null): Promise<LearnerProfile> => invoke('get_learner_profile', { target, personaId })

export const saveLearnerState = (target: string): Promise<string> => invoke('save_learner_state', { target })

export const learnerStateYaml = (target: string): Promise<string> => invoke('export_learner_state', { target })
