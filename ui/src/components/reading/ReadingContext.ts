import { createContext, useContext, useMemo, type ComponentType } from 'react'
import type { ReadingInput, ReplyExplanation } from '../../generated/contracts'
import type { ReadingHelpResult, ReadingLookupOptions } from '../../domain/reading/reading-result'
export type ReadingScope = Omit<ReadingInput, 'text' | 'aid'>
export interface ReadingSelection { text: string; start: number; end: number; scope: ReadingScope; aid?: 'word_gloss' | 'explanations' | 'completions' }
export interface ReadingServices {
  read: (input: ReadingInput, signal: AbortSignal, options?: ReadingLookupOptions) => Promise<ReadingHelpResult>
  saved?: (input: ReadingInput, signal: AbortSignal) => Promise<ReadingHelpResult | null>
  speak: (input: ReadingInput, signal: AbortSignal, onPlayback: () => void, source?: ReadingSelection) => Promise<unknown>
  activity: () => Promise<unknown>
}
export const ReadingTemplateContext = createContext(false)
export const ReadingScopeContext = createContext<ReadingScope | null>(null)
/** Attribution belongs to the initiating surface, independently of reading language overrides. */
export const ReadingConversationContext = createContext<{ id: string; language: string } | null>(null)
export const ReadingPeekContext = createContext<(input: ReadingInput) => ReadingHelpResult | null>(() => null)
export const useReadingPeek = () => useContext(ReadingPeekContext)
export type ReadingLookup = (input: ReadingInput, signal: AbortSignal, options?: ReadingLookupOptions) => Promise<ReadingHelpResult>
export const ReadingLookupContext = createContext<ReadingLookup | null>(null)
export function useReadingLookup() {
  const lookup = useContext(ReadingLookupContext)
  const conversation = useContext(ReadingConversationContext)
  return useMemo<ReadingLookup | null>(() => lookup && conversation ? (input, ...args) =>
    lookup(withConversation(input, conversation), ...args) : lookup, [lookup, conversation])
}
// The reading host composes full message controls into low-level word helpers.
// Injecting their renderer keeps token rendering independent of message bubbles.
export const ReadingCompletionsContext = createContext<ComponentType<{ cards: ReplyExplanation[] }> | null>(null)
export const ReadingActionsContext = createContext<{
  inspect: (selection: ReadingSelection) => void
  speak: (selection: ReadingSelection) => void
  stop: () => void
  speaking: string | null
} | null>(null)
/** Where read-aloud status rises in flow instead of floating bottom-right: on a
 * phone, the page's slot above its recording panel. Null floats it. */
export const ReadAloudSlotContext = createContext<HTMLElement | null>(null)
/** An open modal reading inspector registers its content here so read-aloud
 * status is hosted inside the dialog: a modal makes everything outside its
 * subtree inert, which would leave a floating Stop, Retry or Close unreachable. */
export const ReadAloudHostContext = createContext<((element: HTMLElement | null) => void) | null>(null)
export const speechKey = (selection: ReadingSelection) => JSON.stringify([selection.scope, selection.text.slice(selection.start, selection.end)])
export function useReadingActions() {
  const actions = useContext(ReadingActionsContext)
  const conversation = useContext(ReadingConversationContext)
  return useMemo(() => actions ? { ...actions, inspect: (selection: ReadingSelection) =>
    actions.inspect({ ...selection, scope: withConversation(selection.scope, conversation) }) } : null, [actions, conversation])
}
export function useReadingScope() { return useContext(ReadingScopeContext) }

function withConversation<T extends ReadingScope>(input: T, conversation: { id: string; language: string } | null): T {
  return conversation && input.language === conversation.language
    ? { ...input, conversationId: conversation.id } : input
}
