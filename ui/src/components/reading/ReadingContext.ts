import { createContext, useContext } from 'react'
import type { ReadingInput, ReadingResult } from '../../generated/contracts'
export type ReadingScope = Omit<ReadingInput, 'text' | 'speech'>
export interface ReadingSelection { text: string; start: number; end: number; scope: ReadingScope }
export interface ReadingServices {
  read: (input: ReadingInput, signal: AbortSignal) => Promise<ReadingResult>
  speak: (input: ReadingInput, signal: AbortSignal, onPlayback: () => void) => Promise<unknown>
  activity: () => Promise<unknown>
}
export const ReadingScopeContext = createContext<ReadingScope | null>(null)
export const ReadingPeekContext = createContext<(input: ReadingInput) => ReadingResult | null>(() => null)
export const useReadingPeek = () => useContext(ReadingPeekContext)
export const ReadingLookupContext = createContext<ReadingServices['read'] | null>(null)
export const useReadingLookup = () => useContext(ReadingLookupContext)
export const ReadingActionsContext = createContext<{
  inspect: (selection: ReadingSelection) => void
  speak: (selection: ReadingSelection) => void
  stop: () => void
  speaking: string | null
} | null>(null)
export const speechKey = (selection: ReadingSelection) => JSON.stringify([selection.scope, selection.text.slice(selection.start, selection.end)])
export function useReadingActions() { return useContext(ReadingActionsContext) }
export function useReadingScope() { return useContext(ReadingScopeContext) }
