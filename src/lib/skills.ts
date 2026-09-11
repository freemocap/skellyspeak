import { invoke, getSettings } from './tauri'
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
export async function getSkillEvidence(): Promise<SkillSnapshot> { const settings = await getSettings(); return invoke('get_skill_evidence', { target: settings.target_language }) }
export async function subscribeSkillEvidence(refresh: () => void): Promise<() => void> {
  window.addEventListener('skill-evidence-changed', refresh)
  return () => window.removeEventListener('skill-evidence-changed', refresh)
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

/** Attribute existing awarded credit to its conversation without inventing new XP. */
export function conversationEvidence(snapshot: SkillSnapshot, chatId: string): SkillSnapshot {
  const records = snapshot.records.filter(record => record.chat_id === chatId)
  const ids = new Set(records.map(record => record.attempt_id))
  const credits = snapshot.profile.credits.filter(credit => ids.has(credit.attempt_id))
  const skills = snapshot.profile.skills.map(skill => {
    const own = credits.filter(credit => credit.skill_id === skill.skill_id)
    const successes = own.filter(credit => credit.xp === 10).length
    const assisted = own.filter(credit => credit.xp === 2).length
    return { ...skill, xp: own.reduce((sum, credit) => sum + credit.xp, 0), successes, assisted, checked: successes > 0, star: successes >= 3 }
  })
  return { ...snapshot, records, conversation_count: 1, profile: { ...snapshot.profile, skills, credits, xp: credits.reduce((sum, credit) => sum + credit.xp, 0) } }
}
