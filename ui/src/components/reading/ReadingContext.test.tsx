// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { ReadingActionsContext, ReadingConversationContext, ReadingLookupContext, useReadingActions, useReadingLookup } from './ReadingContext'

const scope = { language: 'spanish', variety: null, explanation: 'english', explanationVariety: null }
it('captures conversation attribution for generated reading and inspector selections', async () => {
  const lookup = vi.fn().mockResolvedValue({})
  const inspect = vi.fn()
  const wrapper = ({ children }: { children: ReactNode }) => <ReadingConversationContext value={{ id: 'chat-a', language: 'spanish' }}>
    <ReadingLookupContext value={lookup}><ReadingActionsContext value={{ inspect, speak: vi.fn(), stop: vi.fn(), speaking: null }}>{children}</ReadingActionsContext></ReadingLookupContext>
  </ReadingConversationContext>
  const { result } = renderHook(() => ({ lookup: useReadingLookup(), actions: useReadingActions() }), { wrapper })
  const signal = new AbortController().signal
  await result.current.lookup!({ ...scope, text: 'Hola', aid: 'translation' }, signal)
  expect(lookup).toHaveBeenCalledWith(expect.objectContaining({ conversationId: 'chat-a', language: 'spanish' }), signal)
  result.current.actions!.inspect({ text: 'Hola', start: 0, end: 4, scope })
  expect(inspect).toHaveBeenCalledWith(expect.objectContaining({ scope: { ...scope, conversationId: 'chat-a' } }))
  await result.current.lookup!({ ...scope, language: 'french', text: 'Bonjour', aid: 'translation' }, signal)
  expect(lookup.mock.lastCall![0]).not.toHaveProperty('conversationId')
})

it('leaves Practice and other surfaces without conversation attribution', async () => {
  const lookup = vi.fn().mockResolvedValue({})
  const wrapper = ({ children }: { children: ReactNode }) => <ReadingLookupContext value={lookup}>{children}</ReadingLookupContext>
  const { result } = renderHook(() => useReadingLookup(), { wrapper })
  await result.current!({ ...scope, text: 'Hola', aid: 'explanations' }, new AbortController().signal)
  expect(lookup.mock.lastCall![0]).not.toHaveProperty('conversationId')
})
