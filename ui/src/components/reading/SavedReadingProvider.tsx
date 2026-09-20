import { createContext, useContext, useId, useLayoutEffect, useMemo, type ReactNode } from 'react'
import { savedGlossIndex, type SavedGlossSource } from '../../domain/reading/saved-gloss-index'

export const SavedReadingRegistryContext = createContext<((id: string, sources: SavedGlossSource[]) => () => void) | null>(null)
export const SavedReadingContext = createContext<ReturnType<typeof savedGlossIndex>>(() => [])
export const useSavedReading = () => useContext(SavedReadingContext)
export function SavedReadingProvider({ sources, children }: { sources: SavedGlossSource[]; children: ReactNode }) {
  const parent = useSavedReading()
  const register = useContext(SavedReadingRegistryContext)
  const id = useId()
  useLayoutEffect(() => register?.(id, sources), [register, id, sources])
  const index = useMemo(() => savedGlossIndex(sources), [sources])
  const resolve = useMemo(() => (text: string, scope: SavedGlossSource['scope']) => {
    const local = index(text, scope)
    return [...local, ...parent(text, scope).filter(part => !local.some(saved => saved.start < part.end && saved.end > part.start))].sort((a,b) => a.start-b.start)
  }, [index, parent])
  return <SavedReadingContext value={resolve}>{children}</SavedReadingContext>
}
