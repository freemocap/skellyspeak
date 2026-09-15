import { invoke } from './ipc/tauri'
import type { PracticeOverview, ProfileChoices, SkillSnapshot } from '../domain/skills/skills'

/// The IPC half of skill evidence. Every function here crosses the Tauri
/// boundary; the snapshot types and credit arithmetic they speak in live in
/// `domain/skills/skills`.
///
/// Nothing here reads settings: the caller passes the target it wants, so this
/// layer stays a boundary rather than a second reader of another store.

export function getSkillEvidence(target: string): Promise<SkillSnapshot> {
  return invoke('get_skill_evidence', { target })
}

export function saveSkillProfile(choices: ProfileChoices): Promise<SkillSnapshot> {
  return invoke('save_skill_profile', { target: choices.target, expectedRevision: choices.revision, choices })
}

export function getPracticeOverview(): Promise<PracticeOverview> { return invoke('get_practice_overview') }
