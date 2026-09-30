import { createContext, useContext, type ComponentType } from 'react'
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
export const ReadingPeekContext = createContext<(input: ReadingInput) => ReadingHelpResult | null>(() => null)
export const useReadingPeek = () => useContext(ReadingPeekContext)
export type ReadingLookup = (input: ReadingInput, signal: AbortSignal, options?: ReadingLookupOptions) => Promise<ReadingHelpResult>
export const ReadingLookupContext = createContext<ReadingLookup | null>(null)
export const useReadingLookup = () => useContext(ReadingLookupContext)
// The reading host composes full message controls into low-level word helpers.
// Injecting their renderer keeps token rendering independent of message bubbles.
export const ReadingCompletionsContext = createContext<ComponentType<{ cards: ReplyExplanation[] }> | null>(null)
export const ReadingActionsContext = createContext<{
  inspect: (selection: ReadingSelection) => void
  speak: (selection: ReadingSelection) => void
  stop: () => void
  speaking: string | null
} | null>(null)
export const speechKey = (selection: ReadingSelection) => JSON.stringify([selection.scope, selection.text.slice(selection.start, selection.end)])
export function useReadingActions() { return useContext(ReadingActionsContext) }
export function useReadingScope() { return useContext(ReadingScopeContext) }
