import { Fragment, useState } from 'react'
import type { WordGlossView } from '../../contracts'

/** Saved UTF-16 anchors select exact source occurrences; reading never requests analysis. */
export function SavedGlossText({ text, result }: { text: string; result: WordGlossView }) {
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set())
  const pieces = []
  let cursor = 0
  for (const segment of result.segments) {
    if (segment.start > cursor) pieces.push(<Fragment key={`gap-${cursor}`}>{text.slice(cursor, segment.start)}</Fragment>)
    const source = text.slice(segment.start, segment.end)
    const open = revealed.has(segment.start)
    const toggle = () => setRevealed(previous => {
      const next = new Set(previous)
      if (next.has(segment.start)) next.delete(segment.start)
      else next.add(segment.start)
      return next
    })
    pieces.push(segment.kind === 'gloss' && segment.gloss !== null
      ? <span className="wu" key={segment.start} data-source-start={segment.start} data-source-end={segment.end}>
          <span className={`w tap${open ? ' revealed' : ''}`} role="button" tabIndex={0} aria-expanded={open}
            onClick={event => { event.stopPropagation(); toggle() }}
            onDoubleClick={event => event.stopPropagation()}
            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); toggle() } }}>
            {source}
          </span>
          {open && <span className="wg" dir="auto">{segment.gloss}</span>}
        </span>
      : <Fragment key={segment.start}>{source}</Fragment>)
    cursor = segment.end
  }
  if (cursor < text.length) pieces.push(<Fragment key={`gap-${cursor}`}>{text.slice(cursor)}</Fragment>)
  return <span className="w" dir="auto" style={{ whiteSpace: 'pre-wrap' }}>{pieces}</span>
}
