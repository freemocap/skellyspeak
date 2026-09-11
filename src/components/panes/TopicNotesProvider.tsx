import { createContext, useMemo, type ReactNode } from 'react'
import { createTopicNotes } from '../../lib/topic-notes'
export const TopicNotesContext = createContext<ReturnType<typeof createTopicNotes> | null>(null)
export function TopicNotesProvider({ scope, children }: { scope: string; children: ReactNode }) {
  const resource = useMemo(() => createTopicNotes(), [scope])
  return <TopicNotesContext value={resource}>{children}</TopicNotesContext>
}
