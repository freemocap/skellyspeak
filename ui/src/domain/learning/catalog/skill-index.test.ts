import { expect, it } from 'vitest'
import { skillDemo } from './skillDemo'
import { createSkillCatalog, evidenceForSkill, skillIndex } from './skill-index'
import { createMessageEvidenceSelector } from '../evidence/message-evidence'
import { unreportedInput, type SkillSnapshot } from '../evidence/skills'

function snapshot(size: number): SkillSnapshot {
  const value = structuredClone(skillDemo)
  value.records = Array.from({ length: size }, (_, i) => ({ attempt_id: `a-${i}`, session_id: 's', turn_id: i, message_id: i, replaces_message_id: null, construct_registry_hash: 'fixture-registry', mapping_error: null, support_step: null, chat_id: 'chat', learner_id: 'demo', target: 'spanish-spain', native: 'english', source: `Ese café ${i}.`, input: unreportedInput(), at_secs: i, model: 'test', provider_mode: 'hosted', catalog_version: value.catalog_version, prompt_version: 'test', status: 'complete', error: null, assessment: { judgments: [{ skill_id: 'identify_describe', presence: 'direct', quotes: ['Ese café'], rationale: 'Ese identifies a particular referent.' }] } }))
  value.profile.credits = value.records.map(record => ({ attempt_id: record.attempt_id, skill_id: 'identify_describe', xp: 10 }))
  return value
}
it('uses snapshot labels and rejects broken catalog ancestry', () => {
  const value = structuredClone(skillDemo)
  value.catalog.find(node => node.id === 'identify_describe')!.label = 'Snapshot label'
  expect(skillIndex(value).catalog.node('identify_describe').label).toBe('Snapshot label')
  value.catalog.find(node => node.id === 'people_things')!.parent = 'identify_describe'
  expect(() => createSkillCatalog(value.catalog)).toThrow('Cyclic')
})
it('classifies excluded and superseded evidence alongside current credit', () => {
  const value = snapshot(3)
  value.profile.choices.excluded_attempts = ['a-0']
  value.records[1].status = 'superseded'
  expect(evidenceForSkill(value, 'identify_describe', null).map(entry => [entry.state, entry.xp])).toEqual([['complete', 10], ['superseded', 0], ['excluded', 0]])
})
it('refuses evidence written by another catalog instead of hiding it', () => {
  const value = snapshot(1)
  value.records[0].catalog_version = 2
  expect(() => skillIndex(value)).toThrow('Evidence uses catalog 2')
})
it('indexes long histories once and retains unchanged message ranges across refreshes', () => {
  const value = snapshot(10000)
  const start = performance.now()
  const index = skillIndex(value)
  expect(skillIndex(value)).toBe(index)
  const selectors = Array.from({ length: 100 }, () => createMessageEvidenceSelector())
  const initial = selectors.map((select, i) => select(value, 'chat', i, value.records[i].source))
  const changed = structuredClone(value)
  changed.profile.choices.excluded_attempts = ['a-9999']
  const next = selectors.map((select, i) => select(changed, 'chat', i, changed.records[i].source))
  next.forEach((ranges, i) => expect(ranges).toBe(initial[i]))
  expect(index.messages.get(JSON.stringify(['chat', 42]))).toHaveLength(1)
  console.info(`Evidence indexing: 10,000 records, two snapshots, 100 mounted selectors: ${(performance.now() - start).toFixed(1)} ms`)
})
