import { expect, it } from 'vitest'
import { skillRewards } from './skill-rewards'
import { skillDemo } from './skillDemo'
import { unreportedInput, type SkillRecord } from './skills'

const record: SkillRecord = { attempt_id: 'a', session_id: 's', turn_id: 1, message_id: 1, replaces_message_id: null, chat_id: 'chat', learner_id: 'demo', target: 'es-ES', native: 'en', source: 'Ese café.', input: unreportedInput(), at_secs: 1, model: 'test', provider_mode: 'hosted', catalog_version: 3, prompt_version: 'test', status: 'complete', error: null, assessment: { judgments: [{ skill_id: 'referent', outcome: 'demonstrated', quotes: ['Ese café'], rationale: 'Identifies the coffee.' }] } }
function completed() {
  const snapshot = structuredClone(skillDemo)
  snapshot.records = [structuredClone(record)]
  snapshot.profile.credits = [{ attempt_id: 'a', skill_id: 'referent', xp: 10 }]
  snapshot.profile.skills.find(skill => skill.skill_id === 'referent')!.xp = 10
  snapshot.profile.xp = 10
  return snapshot
}
it('connects a new credit to the message, phrase, skill and actual catalog domain', () => {
  expect(skillRewards(skillDemo, completed(), 'chat')).toEqual([{ id: 'a:referent', messageId: 1, skillId: 'referent', domainId: 'reference', label: 'Identify a referent', quote: 'Ese café', xp: 10 }])
  const pending = structuredClone(skillDemo)
  pending.records = [{ ...record, status: 'pending', assessment: null }]
  expect(skillRewards(pending, completed(), 'chat')).toHaveLength(1)
})
it('does not celebrate repeat snapshots, other chats, failed reviews, edits or profile changes', () => {
  const snapshot = completed()
  expect(skillRewards(snapshot, snapshot, 'chat')).toEqual([])
  expect(skillRewards(skillDemo, snapshot, 'other')).toEqual([])
  for (const status of ['failed', 'superseded', 'pending'] as const) {
    snapshot.records[0].status = status
    expect(skillRewards(skillDemo, snapshot, 'chat')).toEqual([])
  }
  snapshot.records[0].status = 'complete'
  snapshot.records[0].replaces_message_id = 99
  expect(skillRewards(skillDemo, snapshot, 'chat')).toEqual([])
  snapshot.records[0].replaces_message_id = null
  snapshot.profile.choices.revision++
  expect(skillRewards(skillDemo, snapshot, 'chat')).toEqual([])
})
it('bounds rewards by the net skill gain when unassisted evidence replaces assisted credit', () => {
  const previous = structuredClone(skillDemo)
  previous.profile.skills.find(skill => skill.skill_id === 'referent')!.xp = 2
  expect(skillRewards(previous, completed(), 'chat')[0].xp).toBe(8)
  previous.profile.skills.find(skill => skill.skill_id === 'referent')!.xp = 10
  expect(skillRewards(previous, completed(), 'chat')).toEqual([])
})

it('announces newly credited XP even when its review was already complete', () => {
  const previous = structuredClone(skillDemo)
  previous.records = [structuredClone(record)]
  expect(skillRewards(previous, completed(), 'chat')).toHaveLength(1)
})
