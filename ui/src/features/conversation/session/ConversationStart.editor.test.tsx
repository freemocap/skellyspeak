// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { ConversationStartConfig } from '../../../generated/contracts'
import { ConversationStart } from './ConversationStart'

const value: ConversationStartConfig = { difficulty: 'beginner', varietyId: 'spanish-spain', direction: { topic: null, timeReference: 'any', usePersonaDetails: true } }
vi.mock('../../../platform/ipc/workspace', () => ({
  nativeError: String,
  executeAction: vi.fn(),
  readWorkspace: async () => ({ savedTopics: [], conversations: [{ id: 'chat', contactId: 'contact', languageId: 'spanish' }], contacts: [{ id: 'contact', personaId: 'persona' }], personas: [{ id: 'persona', details: {} }], languages: [{ id: 'spanish' }] }),
}))
vi.mock('./ConversationPromptCreator', () => ({ ConversationPromptCreator: ({ onApply }: { onApply: (configuration: ConversationStartConfig, additions: string[], deletions: string[]) => Promise<void> }) =>
  <button onClick={() => void onApply(value, [], [])}>Apply editor configuration</button> }))

it('captures editor use only on Apply and forwards it with the start configuration', async () => {
  const change = vi.fn(), start = vi.fn()
  const props = { topics: [], busy: false, conversationId: 'chat', value, onChange: change, onStart: start, recording: false, transcribing: false, canPartnerStart: true }
  const view = render(<ConversationStart {...props} />)
  fireEvent.click(screen.getByRole('button', { name: 'Open prompt editor…' }))
  const apply = await screen.findByRole('button', { name: 'Apply editor configuration' })
  expect(change).not.toHaveBeenCalled()
  expect(start).not.toHaveBeenCalled()
  fireEvent.click(apply)
  await waitFor(() => expect(change).toHaveBeenCalledExactlyOnceWith({ ...value, promptEditor: true }))
  expect(start).not.toHaveBeenCalled()
  view.rerender(<ConversationStart {...props} value={change.mock.calls[0][0]} />)
  fireEvent.click(screen.getByRole('button', { name: 'partner starts' }))
  await waitFor(() => expect(start).toHaveBeenCalledExactlyOnceWith({ ...value, promptEditor: true }))
})
