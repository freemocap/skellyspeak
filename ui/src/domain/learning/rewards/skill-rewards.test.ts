import { SKILL_CATALOG_VERSION } from '../../../generated/contracts'
import { expect, it } from 'vitest'
import { skillRewards } from './skill-rewards'
import { skillDemo } from '../catalog/skillDemo'
import { conversationEvidence, unreportedInput, type SkillRecord } from '../evidence/skills'

const record: SkillRecord = { attempt_id: 'a', session_id: 's', turn_id: 1, message_id: 1, replaces_message_id: null, construct_registry_hash: 'fixture-registry', mapping_error: null, support_step: null, chat_id: 'chat', learner_id: 'demo', target: 'spanish-spain', native: 'english', source: 'Ese café.', input: unreportedInput(), at_secs: 1, model: 'test', provider_mode: 'hosted', catalog_version: SKILL_CATALOG_VERSION, prompt_version: 'test', status: 'complete', error: null, assessment: { judgments: [{ skill_id: 'identify_describe', presence: 'direct', quotes: ['Ese café'], rationale: 'Identifies the coffee.' }] } }
function completed() {
  const snapshot = structuredClone(skillDemo)
  snapshot.records = [structuredClone(record)]
  snapshot.profile.credits = [{ attempt_id: 'a', skill_id: 'identify_describe', xp: 10 }]
  snapshot.profile.skills.find(skill => skill.skill_id === 'identify_describe')!.xp = 10
  snapshot.profile.xp = 10
  return snapshot
}
it('connects a new credit to the message, phrase, skill and actual catalog domain', () => {
  expect(skillRewards(skillDemo, completed(), 'chat')).toEqual([{ id: 'a:identify_describe', messageId: 1, skillId: 'identify_describe', domainId: 'people_things', label: 'Identify and describe', quote: 'Ese café', xp: 10 }])
  const pending = structuredClone(skillDemo)
  pending.records = [{ ...record, status: 'pending', assessment: null }]
  expect(skillRewards(pending, completed(), 'chat')).toHaveLength(1)
})
it('does not celebrate repeat snapshots, other chats, failed reviews or profile changes', () => {
  const snapshot = completed()
  expect(skillRewards(snapshot, snapshot, 'chat')).toEqual([])
  expect(skillRewards(skillDemo, snapshot, 'other')).toEqual([])
  for (const status of ['failed', 'superseded', 'pending'] as const) {
    snapshot.records[0].status = status
    expect(skillRewards(skillDemo, snapshot, 'chat')).toEqual([])
  }
  snapshot.records[0].status = 'complete'
  snapshot.profile.choices.revision++
  expect(skillRewards(skillDemo, snapshot, 'chat')).toEqual([])
})
it('bounds rewards by the net skill gain when experience evidence replaces effort credit', () => {
  const previous = structuredClone(skillDemo)
  previous.profile.skills.find(skill => skill.skill_id === 'identify_describe')!.xp = 2
  expect(skillRewards(previous, completed(), 'chat')[0].xp).toBe(8)
  previous.profile.skills.find(skill => skill.skill_id === 'identify_describe')!.xp = 10
  expect(skillRewards(previous, completed(), 'chat')).toEqual([])
})

it('announces newly credited XP even when its review was already complete', () => {
  const previous = structuredClone(skillDemo)
  previous.records = [structuredClone(record)]
  expect(skillRewards(previous, completed(), 'chat')).toHaveLength(1)
})

it('conversation XP attributes only its existing credits and preserves the language total', () => {
  const all = completed()
  all.records.push({ ...record, attempt_id: 'b', chat_id: 'second' })
  all.profile.credits.push({ attempt_id: 'b', skill_id: 'identify_describe', xp: 1, experience: 0, effort: 1 })
  all.profile.xp = 11
  const scoped = conversationEvidence(all, 'second')
  expect(scoped.profile.xp).toBe(1)
  expect(scoped.records.map(item => item.attempt_id)).toEqual(['b'])
  expect(scoped.profile.skills.find(item => item.skill_id === 'identify_describe')).toMatchObject({ xp: 1, effort: 1, experience: 0 })
  expect(all.profile.xp).toBe(11)
  expect(conversationEvidence(all, 'empty').profile.xp).toBe(0)
})

it('celebrates native effort revision credit only to its positive net increase', () => {
  const current = completed()
  current.records[0].replaces_message_id = 99
  current.records[0].input.revision = true
  current.profile.credits[0].xp = 2
  current.profile.skills.find(skill => skill.skill_id === 'identify_describe')!.xp = 2
  current.profile.xp = 2
  expect(skillRewards(skillDemo, current, 'chat')).toMatchObject([{ xp: 2, messageId: 1 }])
  const previous = structuredClone(skillDemo)
  previous.profile.skills.find(skill => skill.skill_id === 'identify_describe')!.xp = 1
  expect(skillRewards(previous, current, 'chat')).toMatchObject([{ xp: 1 }])
  previous.profile.skills.find(skill => skill.skill_id === 'identify_describe')!.xp = 10
  expect(skillRewards(previous, current, 'chat')).toEqual([])
  expect(skillRewards(current, structuredClone(current), 'chat')).toEqual([])
  current.profile.choices.excluded_attempts.push('a')
  expect(skillRewards(skillDemo, current, 'chat')).toEqual([])
  current.profile.choices.excluded_attempts = []
  // Native wording deduplication supplies no credit; the presenter invents none.
  current.profile.credits = []
  expect(skillRewards(skillDemo, current, 'chat')).toEqual([])
})

it('credits explicit whole-message evidence without inventing a supporting quote', () => {
  const snapshot = completed()
  snapshot.records[0].assessment_adapter = 'jev_choice'
  const judgment = snapshot.records[0].assessment!.judgments[0]
  judgment.evidence_kind = 'whole_message'; judgment.quotes = []; judgment.rationale = ''
  expect(skillRewards(skillDemo, snapshot, 'chat')[0]).toMatchObject({ quote: snapshot.records[0].source, xp: 10 })
  snapshot.records[0].assessment_adapter = 'chat_model'
  expect(() => skillRewards(skillDemo, snapshot, 'chat')).toThrow('evidence')
})
