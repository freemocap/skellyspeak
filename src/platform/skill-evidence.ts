import { invoke, getSettings } from './ipc/tauri'
import type { PracticeOverview, ProfileChoices, SkillSnapshot } from '../domain/skills/skills'

/// The IPC half of skill evidence. Every function here crosses the Tauri
/// boundary; the snapshot types and credit arithmetic they speak in live in
/// `./skills`.

export async function getSkillEvidence(): Promise<SkillSnapshot> { const settings = await getSettings(); return invoke('get_skill_evidence', { target: settings.target_language }) }

/// The native side announces a change through a window event; this is the only
/// signal the UI has that evidence moved without the learner doing anything.
export async function subscribeSkillEvidence(refresh: () => void): Promise<() => void> {
  window.addEventListener('skill-evidence-changed', refresh)
  return () => window.removeEventListener('skill-evidence-changed', refresh)
}

export function saveSkillProfile(choices: ProfileChoices): Promise<SkillSnapshot> {
  return invoke('save_skill_profile', { target: choices.target, expectedRevision: choices.revision, choices })
}

export function getPracticeOverview(): Promise<PracticeOverview> { return invoke('get_practice_overview') }
