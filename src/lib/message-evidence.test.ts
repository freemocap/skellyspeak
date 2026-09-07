import { expect, it } from 'vitest'
import { skillDemo } from './skillDemo'
import { unreportedInput } from './skills'
import { messageEvidence } from './message-evidence'

function reviewed() {
  const snapshot = structuredClone(skillDemo)
  snapshot.records = [{ attempt_id: 'a', session_id: 's', turn_id: 1, message_id: 1, replaces_message_id: null, chat_id: 'chat', learner_id: 'demo', target: 'es-ES', native: 'en', source: 'Ese café.', input: unreportedInput(), at_secs: 1, model: 'test', provider_mode: 'hosted', catalog_version: snapshot.catalog_version, prompt_version: 'test', status: 'complete', error: null, assessment: { judgments: [{ skill_id: 'referent', outcome: 'demonstrated', quotes: ['Ese café'], rationale: 'Identifies the coffee.' }] } }]
  snapshot.profile.credits = [{ attempt_id: 'a', skill_id: 'referent', xp: 2 }]
  return snapshot
}
it('ties a source range and explanation to actual credited XP', () => {
  const spans = messageEvidence(reviewed(), 'chat', 1, 'Ese café.')
  expect(spans).toHaveLength(1)
  expect(spans[0]).toMatchObject({ start: 0, end: 8, id: 'a:referent' })
  expect(spans[0].explanation).toContain('2 XP for this message')
})
it('never paints stale, failed, excluded or uncredited evidence', () => {
  const snapshot = reviewed()
  expect(messageEvidence(snapshot, 'other', 1, 'Ese café.')).toEqual([])
  expect(messageEvidence(snapshot, 'chat', 1, 'Otro café.')).toEqual([])
  snapshot.records[0].status = 'failed'
  expect(messageEvidence(snapshot, 'chat', 1, 'Ese café.')).toEqual([])
  snapshot.records[0].status = 'complete'
  snapshot.profile.choices.excluded_attempts = ['a']
  expect(messageEvidence(snapshot, 'chat', 1, 'Ese café.')).toEqual([])
  snapshot.profile.choices.excluded_attempts = []
  snapshot.profile.credits = []
  expect(messageEvidence(snapshot, 'chat', 1, 'Ese café.')).toEqual([])
})
