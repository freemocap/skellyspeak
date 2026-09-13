import { invoke } from '@tauri-apps/api/core'
import type { LearnerState } from '../../contracts'
import type { SkillSnapshot } from '../../domain/skills/skills'
export interface LearnerProfile { evidence: SkillSnapshot; model: LearnerState }
export const getLearnerProfile = (target: string): Promise<LearnerProfile> => invoke('get_learner_profile', { target })
