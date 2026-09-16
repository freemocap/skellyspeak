// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { EvidenceMappingNotice } from './EvidenceMappingNotice'
import { skillDemo } from '../../domain/learning/catalog/skillDemo'
import { unreportedInput } from '../../domain/learning/evidence/skills'

it('keeps completed evidence from changed registries inspectable with its original source and IDs', () => {
  const snapshot = structuredClone(skillDemo)
  snapshot.records = [{ attempt_id: 'old-attempt', session_id: 's', turn_id: 1, message_id: 1, replaces_message_id: null, construct_registry_hash: 'old-full-hash', mapping_error: 'Evidence retained; current credit is unavailable.', support_step: null, chat_id: 'chat', learner_id: snapshot.learner_id, target: snapshot.target, native: 'english', source: 'Ese café.', input: unreportedInput(), at_secs: 1, model: 'fixture', provider_mode: 'hosted', catalog_version: 1, prompt_version: 'fixture', status: 'complete', error: null, assessment: { judgments: [{ skill_id: 'removed-construct', outcome: 'demonstrated', quotes: ['Ese café'], rationale: '' }] } }]
  render(<EvidenceMappingNotice snapshot={snapshot} chatId="chat" messageId={1} />)
  expect(screen.getByRole('alert')).toHaveTextContent('1 observation cannot be mapped')
  fireEvent.click(screen.getByText('Inspect retained evidence'))
  expect(screen.getByText('Ese café.')).toBeVisible()
  expect(screen.getByText('removed-construct')).toBeVisible()
  expect(screen.getByText('old-full-hash')).toBeVisible()
  expect(screen.getByText('fixture-registry')).toBeVisible()
  expect(screen.getByText('Evidence retained; current credit is unavailable.')).toBeVisible()
})
