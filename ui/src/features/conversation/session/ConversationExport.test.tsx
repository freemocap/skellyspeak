// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ConversationExport } from './ConversationExport'
const api = vi.hoisted(() => ({ conversationYaml: vi.fn(), saveConversationYaml: vi.fn() }))
vi.mock('../../../platform/ipc/conversation-export', () => api)
beforeEach(() => {
  vi.clearAllMocks()
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
  api.conversationYaml.mockResolvedValue('messages: []')
  api.saveConversationYaml.mockResolvedValue('/Downloads/conversation.yaml')
})
it('defaults to conversation only and passes independent opt-ins to both native actions', async () => {
  render(<ConversationExport conversationId="conversation-a" onClose={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'View YAML' }))
  await screen.findByText('messages: []')
  expect(api.conversationYaml).toHaveBeenCalledWith({ conversationId: 'conversation-a', includeCoach: false, includeBackend: false })
  fireEvent.click(screen.getByLabelText('Include coaching and private coach chat'))
  expect(screen.queryByText('messages: []')).toBeNull()
  fireEvent.click(screen.getByLabelText(/Include backend activity/))
  fireEvent.click(screen.getByRole('button', { name: 'Save YAML' }))
  await screen.findByRole('status')
  expect(api.saveConversationYaml).toHaveBeenCalledWith({ conversationId: 'conversation-a', includeCoach: true, includeBackend: true })
})
