// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { skillDemo } from '../../../domain/learning/catalog/skillDemo'
import { unreportedInput } from '../../../domain/learning/evidence/skills'
import { SkillEvidenceContext } from '../../../state/learning/useSkillEvidence'
import { MessageSkillAnalysis } from './MessageSkillAnalysis'

it('shows retained evidence and its guide even when this retry earned no additional XP', () => {
  const snapshot = structuredClone(skillDemo)
  snapshot.records = [{ attempt_id: 'a', session_id: 's', turn_id: 1, message_id: 1, replaces_message_id: null, construct_registry_hash: 'fixture-registry', mapping_error: null, support_step: null, chat_id: 'chat', learner_id: 'demo', target: 'spanish-spain', native: 'english', source: 'Ese café.', input: unreportedInput(), at_secs: 1, model: 'test', provider_mode: 'hosted', catalog_version: snapshot.catalog_version, prompt_version: 'test', status: 'complete', error: null, assessment: { judgments: [{ skill_id: 'identify_describe', presence: 'direct', quotes: ['Ese café'], rationale: '' }] } }]
  snapshot.profile.credits = []
  const view = (source: string) => <SkillEvidenceContext value={{snapshot, error: null}}><MessageSkillAnalysis conversationId="chat" messageId={1} source={source} /></SkillEvidenceContext>
  const { rerender } = render(view('Ese café.'))
  expect(screen.getByRole('region', {name: 'Skills'})).toBeVisible()
  expect(screen.getByText('Skills').closest('details')).not.toHaveAttribute('open')
  fireEvent.click(screen.getByText('Skills'))
  expect(screen.getByText('Skill guide')).toBeVisible()
  rerender(view('Otro café.'))
  expect(screen.queryByRole('region', {name: 'Skills'})).toBeNull()
})
