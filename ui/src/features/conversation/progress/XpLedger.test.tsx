// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { XpLedger } from './XpLedger'
import { skillDemo } from '../../../domain/learning/catalog/skillDemo'
import { unreportedInput } from '../../../domain/learning/evidence/skills'
it('counts contributing messages once, shows this conversation’s skills, and preserves credit inspection', () => {
  const snapshot = structuredClone(skillDemo)
  snapshot.records = [{ attempt_id: 'a', session_id: 's', turn_id: 1, message_id: 1, replaces_message_id: null, construct_registry_hash: 'fixture-registry', mapping_error: null, support_step: null, chat_id: 'chat', learner_id: 'demo', target: snapshot.target, native: 'english', source: 'Ese café.', input: unreportedInput(), at_secs: 1, model: 'test', provider_mode: 'hosted', catalog_version: snapshot.catalog_version, prompt_version: 'test', status: 'complete', error: null, assessment: { judgments: [{ skill_id: 'people_places', presence: 'direct', quotes: ['Ese café'], rationale: 'Identifies the coffee.' }] } }]
  snapshot.profile.credits = [{ attempt_id: 'a', skill_id: 'people_places', xp: 1 }]
  const inspect = vi.fn()
  render(<XpLedger snapshot={snapshot} chatId="chat" onInspectMessage={inspect} />)
  const skills = screen.getByRole('table', { name: 'Skills in this conversation' })
  expect(skills).toHaveTextContent('People, things, and places')
  expect(skills).toHaveTextContent('100%')
  expect(screen.queryByText('Understood')).toBeNull()
  expect(screen.getByText('Contributing messages').parentElement).toHaveTextContent('1')
  expect(screen.getByText('XP per contributing message').parentElement).toHaveTextContent('1')
  fireEvent.click(screen.getByRole('button', { name: /People, things, and places/ }))
  expect(inspect).toHaveBeenCalledWith({ chatId: 'chat', messageId: 1, source: 'Ese café.' })
})
