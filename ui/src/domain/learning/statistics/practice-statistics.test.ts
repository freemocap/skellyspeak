import { experienceProfile } from './experience-profile'
import { SKILL_CATALOG_VERSION } from '../../../generated/contracts'
import { expect, it } from 'vitest'
import { skillDemo } from '../catalog/skillDemo'
import { practiceStatistics } from './practice-statistics'
import type { SkillRecord, SkillSnapshot } from '../evidence/skills'

function sample(): SkillSnapshot {
  const snapshot = structuredClone(skillDemo)
  const [first, second] = snapshot.profile.skills
  const record: SkillRecord = { attempt_id: 'a', session_id: 's', turn_id: 1, message_id: 1, replaces_message_id: null, construct_registry_hash: 'fixture-registry', mapping_error: null, support_step: null, chat_id: 'chat', learner_id: snapshot.learner_id, target: snapshot.target, native: 'english', source: 'That cup is blue.', input: { modality: 'text', suggestion: false, scaffold: false, revision: false }, at_secs: 100, model: 'test', provider_mode: 'custom', catalog_version: SKILL_CATALOG_VERSION, prompt_version: 'v1', status: 'complete', assessment: { judgments: [first, second].map(skill => ({ skill_id: skill.skill_id, presence: 'direct', quotes: ['cup'], rationale: 'Recorded judgment' })) }, error: null }
  snapshot.records = [record, { ...record, attempt_id: 'b', message_id: 2, source: 'That red cup.', input: { ...record.input, suggestion: true } }]
  Object.assign(first, { experience: 1, effort: 1, xp: 2 })
  Object.assign(second, { experience: 1, xp: 1 })
  snapshot.profile.xp = 3
  snapshot.profile.credits = [{ attempt_id: 'a', skill_id: first.skill_id, experience: 1, effort: 0 }, { attempt_id: 'a', skill_id: second.skill_id, experience: 1, effort: 0 }, { attempt_id: 'b', skill_id: first.skill_id, experience: 0, effort: 1 }].map(c => ({...c, xp: 1, event: {id:`${c.attempt_id}:${c.skill_id}`,attemptId:c.attempt_id,constructId:c.skill_id,kind:c.effort?'effort':'experience',tier:1,xp:1,experience:c.experience,effort:c.effort,quote:'cup',support:'not_weighted',difficulty:'not_weighted',novelty:'not_weighted',policyHash:'experience-effort-1',atSecs:1n,claimed:false}}))
  return snapshot
}

it('reconciles domain totals and distinguishes skill demonstrations from contributing messages', () => {
  const stats = practiceStatistics(sample())
  expect(stats.domains.reduce((sum, domain) => sum + domain.xp, 0)).toBe(3)
  expect(stats.experience).toBe(2)
  expect(stats.effort).toBe(1)
  expect(stats.contributingMessages).toBe(2)
  expect(stats.practiced).toBe(2)
})
it('shows true zero counts for an empty language profile', () => {
  const stats = practiceStatistics(skillDemo)
  expect(stats.contributingMessages).toBe(0)
  expect(stats.experience + stats.effort).toBe(0)
  expect(stats.domains.every(domain => domain.xp === 0)).toBe(true)
})
it('rejects cross-language evidence and mismatched XP ledgers', () => {
  const snapshot = sample()
  snapshot.records[0].target = 'arabic'
  expect(() => practiceStatistics(snapshot)).toThrow('another language')
  snapshot.records[0].target = snapshot.target
  snapshot.profile.credits.pop()
  expect(() => practiceStatistics(snapshot)).toThrow('ledger')
})

it('projects experience and effort by exact variety without counting other varieties', () => {
  const snapshot = sample()
  snapshot.records[0].variety = 'one'
  snapshot.records[1].variety = 'two'
  const one = experienceProfile(snapshot, 'one')
  expect([one.experience, one.effort, one.xp, one.used]).toEqual([2, 0, 2, 2])
  const two = experienceProfile(snapshot, 'two')
  expect([two.experience, two.effort, two.xp, two.used]).toEqual([0, 1, 1, 0])
  expect(experienceProfile(snapshot, 'empty').skills.every(skill => skill.xp === 0)).toBe(true)
  expect(experienceProfile(snapshot, null).xp).toBe(3)
})
it('recalculates after excluded credit is removed, without retaining profile state', () => {
  const snapshot = sample()
  expect(experienceProfile(snapshot, null).xp).toBe(3)
  snapshot.profile.choices.excluded_attempts = ['b']
  snapshot.profile.credits = snapshot.profile.credits.filter(credit => credit.attempt_id !== 'b')
  snapshot.profile.xp = 2
  snapshot.profile.skills[0].xp = 1
  snapshot.profile.skills[0].effort = 0
  expect(experienceProfile(snapshot, null).xp).toBe(2)
  expect(experienceProfile(snapshot, null).effort).toBe(0)
})
