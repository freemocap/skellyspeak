// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { LessonProgress } from './LessonProgress'
import { SkillEvidenceContext } from '../../hooks/useSkillEvidence'
import { skillDemo } from '../../lib/skillDemo'
import { unreportedInput, type SkillRecord, type SkillSnapshot } from '../../lib/skills'

const record: SkillRecord = {
  attempt_id: 'a', session_id: 's', turn_id: 1, message_id: 1, replaces_message_id: null,
  chat_id: 'chat', learner_id: 'local', target: 'es-ES', native: 'en', source: 'Ese libro.',
  input: unreportedInput(), at_secs: 1, model: 'model', provider_mode: 'hosted',
  catalog_version: 3, prompt_version: 'test', status: 'pending', error: null, assessment: null,
}
function ui(snapshot: SkillSnapshot | null, error: string | null = null) {
  return <SkillEvidenceContext value={{ saving: false, save: async () => {}, snapshot, error }}><LessonProgress chatId="chat" busy={false} level="zero" /></SkillEvidenceContext>
}
it('updates pending evidence into credited XP with its source, rationale and skill milestone', () => {
  const snapshot = structuredClone(skillDemo)
  snapshot.records = [record]
  const view = render(ui(snapshot))
  expect(screen.getByRole('status')).toHaveTextContent('Reviewing your words')
  const completed: SkillSnapshot = { ...snapshot, records: [{ ...record, status: 'complete', assessment: { judgments: [{ skill_id: 'referent', outcome: 'demonstrated', quotes: ['Ese libro'], rationale: 'You identified a specific book.' }] } }], profile: { ...snapshot.profile, xp: 10, credits: [{ attempt_id: 'a', skill_id: 'referent', xp: 10 }], skills: snapshot.profile.skills.map((skill) => skill.skill_id === 'referent' ? { ...skill, xp: 10, successes: 1, checked: true } : skill) } }
  view.rerender(ui(completed))
  fireEvent.click(screen.getByText('Recent message reviews'))
  expect(screen.getByText('10 XP credited')).toBeVisible()
  expect(screen.getByText('Ese libro.', { selector: 'blockquote' })).toBeVisible()
  expect(screen.getByText('You identified a specific book.')).toBeVisible()
  expect(screen.getAllByText('1/3 successes to a star').length).toBeGreaterThan(0)
  view.rerender(ui({ ...completed, profile: { ...completed.profile, credits: [] } }))
  expect(screen.getByText('0 XP credited')).toBeVisible()
  expect(screen.getByText(/No current credit/)).toBeVisible()
})
it('isolates conversation evidence and shows failures instead of rewards', () => {
  const view = render(ui({ ...skillDemo, records: [{ ...record, chat_id: 'other' }] }))
  expect(screen.queryByText('Ese libro.')).toBeNull()
  view.rerender(ui({ ...skillDemo, records: [{ ...record, status: 'failed', error: 'Review unavailable' }] }))
  expect(screen.getByRole('alert')).toHaveTextContent('Review unavailable')
  expect(screen.queryByText(/XP credited/)).toBeNull()
  view.rerender(ui(null, 'Connection lost'))
  expect(screen.getByRole('alert')).toHaveTextContent('Connection lost')
})
