// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { CoachIntentTip } from './CoachIntentTip'
import type { ConversationStartConfig } from '../../../generated/contracts'
const backend = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('../../../platform/ipc/native', () => backend)
it('loads real deterministic targets on hover, including unavailable effort mode', async () => {
  backend.invoke.mockImplementation(async (_name, args) => {
    if (args.configuration.direction.topic.mode === 'continuePracticing') throw new Error('No retry effort recorded.')
    return { coachFocus: { skillId: 'past', name: 'Past events', mode: 'explore', experience: 3, effort: 0 } }
  })
  const configuration: ConversationStartConfig = { difficulty: 'beginner', varietyId: 'spanish-spain', direction: { topic: null, timeReference: 'any', usePersonaDetails: true } }
  render(<CoachIntentTip conversationId="chat" configuration={configuration} />)
  expect(backend.invoke).not.toHaveBeenCalled()
  fireEvent.mouseEnter(screen.getByRole('button', { name: 'Information' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No retry effort recorded.'))
  expect(backend.invoke).toHaveBeenCalledTimes(3)
  expect(screen.getAllByText(/Past events/)).toHaveLength(2)
  expect(screen.getAllByText(/Experience: 3/)).toHaveLength(2)
  expect(backend.invoke.mock.calls.every(([name]) => name === 'preview_conversation_prompt')).toBe(true)
})
