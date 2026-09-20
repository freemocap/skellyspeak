import { Fragment } from 'react'
import { TargetText } from './TargetText'
import { sourceScriptRuns } from '../../domain/language/script-text'

export function MixedText({ text }: { text: string }) {
  const pieces = []
  let cursor = 0
  for (const match of sourceScriptRuns(text)) {
    if (match.start > cursor) pieces.push(<Fragment key={cursor}>{text.slice(cursor, match.start)}</Fragment>)
    pieces.push(<bdi key={`source-${match.start}`}><TargetText text={match.text} /></bdi>)
    cursor = match.end
  }
  if (cursor < text.length) pieces.push(<Fragment key={cursor}>{text.slice(cursor)}</Fragment>)
  return <>{pieces}</>
}
