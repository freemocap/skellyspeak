import { invoke } from './tauri'
import type { TreeNode } from '../pages/skillTree'

export interface InputEvidence {
  modality: 'text' | 'speech_transcript'
  suggestion: boolean
  scaffold: boolean
  revision: boolean
}
export const unreportedInput = (): InputEvidence => ({ modality: 'text', suggestion: false, scaffold: false, revision: false })
export type SkillOutcome = 'demonstrated' | 'partial' | 'not_demonstrated' | 'not_observed' | 'uncertain'
export interface SkillJudgment {
  skill_id: string
  outcome: SkillOutcome
  quotes: string[]
  rationale: string
}
export interface SkillRecord {
  attempt_id: string
  session_id: string
  turn_id: number
  message_id: number
  replaces_message_id: number | null
  chat_id: string
  learner_id: string
  target: string
  native: string
  source: string
  input: InputEvidence
  at_secs: number
  model: string
  provider_mode: string
  catalog_version: number
  prompt_version: string
  status: 'pending' | 'complete' | 'failed' | 'superseded'
  assessment: { judgments: SkillJudgment[] } | null
  error: string | null
}
export interface SkillSnapshot {
  catalog: TreeNode[]
  catalog_version: number
  learner_id: string
  target: string
  conversation_count: number
  records: SkillRecord[]
  profile: LearnerProfile
}
export function getSkillEvidence(): Promise<SkillSnapshot> { return invoke('get_skill_evidence') }
export async function subscribeSkillEvidence(refresh: () => void): Promise<() => void> {
  const { listen } = await import('@tauri-apps/api/event')
  return listen('skills:changed', refresh)
}

export interface ProfileChoices {
  version: number
  revision: number
  learner_id: string
  target: string
  focus: string | null
  excluded_attempts: string[]
}
export interface SkillProgress {
  skill_id: string
  successes: number
  assisted: number
  xp: number
  checked: boolean
  star: boolean
}
export interface LearnerProfile {
  credits: { attempt_id: string; skill_id: string; xp: number }[]
  rules_version: number
  choices: ProfileChoices
  xp: number
  skills: SkillProgress[]
  branches: { skill_id: string; available: boolean }[]
  recommended_focus: string
  active_focus: string
}
export function saveSkillProfile(choices: ProfileChoices): Promise<SkillSnapshot> {
  return invoke('save_skill_profile', { target: choices.target, expectedRevision: choices.revision, choices })
}

export interface PracticeOverview {
  languages: { name: string; endonym: string; snapshot: SkillSnapshot }[]
}
export function getPracticeOverview(): Promise<PracticeOverview> { return invoke('get_practice_overview') }
