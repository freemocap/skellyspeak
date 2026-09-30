import { expect, it, vi } from 'vitest'
import { invoke } from './native'
import { readMessageHistory } from './message-history'

vi.mock('./native', () => ({ invoke: vi.fn() }))

it('requests version history by durable message identity without a chat page cursor', async () => {
  const history = { conversationId: 'conversation', rootMessageId: 'original', currentMessageId: 'latest', versions: [] }
  vi.mocked(invoke).mockResolvedValueOnce(history)
  expect(await readMessageHistory('conversation', 'older-version')).toBe(history)
  expect(invoke).toHaveBeenCalledExactlyOnceWith('get_message_history', { conversationId: 'conversation', messageId: 'older-version' })
})
