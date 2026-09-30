import { invoke } from './tauri'
import type { SkillLevelEvent } from '../../generated/contracts'

/** Materialize catch-up once per active language; safe to repeat after refresh. */
export function initializeSkillLevelEvents(target: string): Promise<SkillLevelEvent[]> {
  return invoke('initialize_skill_level_events', { target })
}

/** Claim at most 100 ordered events immediately before presentation. Refresh afterward. */
export function claimSkillLevelEvents(target: string, ids: string[]): Promise<SkillLevelEvent[]> {
  return invoke('claim_skill_level_events', { target, ids })
}
