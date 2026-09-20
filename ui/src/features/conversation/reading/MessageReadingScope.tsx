import type { ReactNode } from 'react'
import type { ReadingScope } from '../../../generated/contracts'
import { ReadingScopeContext } from '../../../components/reading/ReadingContext'
import { ReadingLanguageScope } from '../../../components/reading/ReadingLanguageScope'

/** Saved assistance keeps its captured language pair after preferences change. */
export function MessageReadingScope({ scope, children }: { scope?: ReadingScope | null; children: ReactNode }) {
  if (!scope) return <>{children}</>
  return <ReadingScopeContext value={scope}><ReadingLanguageScope language={scope.language} variety={scope.variety}>{children}</ReadingLanguageScope></ReadingScopeContext>
}
