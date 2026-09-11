import { expect, it } from 'vitest'
import { skillDemo } from './skillDemo'
import { practiceStatistics } from './practice-statistics'
import type { SkillRecord, SkillSnapshot } from './skills'

function sample(): SkillSnapshot {
  const snapshot = structuredClone(skillDemo)
  const [first, second] = snapshot.profile.skills
  const record: SkillRecord = { attempt_id: 'a', session_id: 's', turn_id: 1, message_id: 1, replaces_message_id: null, chat_id: 'chat', learner_id: snapshot.learner_id, target: snapshot.target, native: 'en', source: 'That cup is blue.', input: { modality: 'text', suggestion: false, scaffold: false, revision: false }, at_secs: 100, model: 'test', provider_mode: 'custom', catalog_version: 4, prompt_version: 'v1', status: 'complete', assessment: { judgments: [first, second].map(skill => ({ skill_id: skill.skill_id, outcome: 'demonstrated', quotes: ['cup'], rationale: 'Recorded judgment' })) }, error: null }
  snapshot.records = [record, { ...record, attempt_id: 'b', message_id: 2, source: 'That red cup.', input: { ...record.input, suggestion: true } }]
  Object.assign(first, { successes: 1, assisted: 1, xp: 12 })
  Object.assign(second, { successes: 1, xp: 10 })
  snapshot.profile.xp = 22
  snapshot.profile.credits = [{ attempt_id: 'a', skill_id: first.skill_id, xp: 10 }, { attempt_id: 'a', skill_id: second.skill_id, xp: 10 }, { attempt_id: 'b', skill_id: first.skill_id, xp: 2 }]
  return snapshot
}

it('reconciles domain totals and distinguishes skill demonstrations from contributing messages', () => {
  const stats = practiceStatistics(sample())
  expect(stats.domains.reduce((sum, domain) => sum + domain.xp, 0)).toBe(22)
  expect(stats.unassisted).toBe(2)
  expect(stats.assisted).toBe(1)
  expect(stats.contributingMessages).toBe(2)
  expect(stats.practiced).toBe(2)
})
it('shows true zero counts for an empty language profile', () => {
  const stats = practiceStatistics(skillDemo)
  expect(stats.contributingMessages).toBe(0)
  expect(stats.unassisted + stats.assisted).toBe(0)
  expect(stats.domains.every(domain => domain.xp === 0)).toBe(true)
})
it('rejects cross-language evidence and mismatched XP ledgers', () => {
  const snapshot = sample()
  snapshot.records[0].target = 'ar'
  expect(() => practiceStatistics(snapshot)).toThrow('another language')
  snapshot.records[0].target = snapshot.target
  snapshot.profile.credits.pop()
  expect(() => practiceStatistics(snapshot)).toThrow('ledger')
})
