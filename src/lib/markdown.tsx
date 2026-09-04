import { Fragment, type ReactNode } from 'react'

/// The small slice of Markdown that models actually emit into coach text:
/// paragraphs, bullet lists, fenced code, inline code, bold and italic — plus
/// `[[curiosity markers]]`, which are ours rather than Markdown's.
///
/// Hand-written rather than a library, and deliberately building React nodes
/// rather than HTML. This renders model output, so `dangerouslySetInnerHTML`
/// would be an injection route straight from whatever the provider returned —
/// and every element below is one this app chose, not one the text asked for.
///
/// Anything it does not recognise is rendered as the literal text it is. A
/// stray `#` is better than a swallowed sentence.

/// A rabbit hole the coach offered: `[[the subjunctive]]`.
///
/// Pressing one asks the coach about that term, so the marker is a real way
/// in rather than decoration — which is the only reason the prompt is allowed
/// to ask for them. Without a handler it renders as its own words, never as
/// visible brackets: a marker nobody can press should look like ordinary text,
/// not like a broken button.
export type TermHandler = (term: string) => void

/// `[[term]]`, then `code`, then **bold**, then *italic*. Bold is tried before
/// italic so that `**x**` is not read as an empty italic wrapping `*x*`.
const INLINE = /\[\[([^\]\n]+)\]\]|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*\n]+)\*/g

/// Split one line's inline markup into React nodes.
function inline(text: string, keyPrefix: string, onTerm?: TermHandler): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  INLINE.lastIndex = 0
  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index))
    const key = `${keyPrefix}-${match.index}`
    const [, term, code, bold, italic] = match
    if (term !== undefined) {
      out.push(
        onTerm ? (
          <button
            key={key}
            type="button"
            className="md-term"
            title={`Ask the coach about ${term}`}
            onClick={() => onTerm(term)}
          >
            {term}
          </button>
        ) : (
          term
        )
      )
    } else if (code !== undefined) out.push(<code key={key}>{code}</code>)
    else if (bold !== undefined) out.push(<strong key={key}>{bold}</strong>)
    else out.push(<em key={key}>{italic}</em>)
    last = match.index + match[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/// A run of lines that belong to the same paragraph, with the line breaks the
/// author wrote preserved. Markdown proper would fold them into one line, but
/// a coach writing three short observations on three lines means three lines.
function paragraph(lines: string[], key: string, onTerm?: TermHandler): ReactNode {
  return (
    <p className="md-p" key={key}>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {inline(line, `${key}-${i}`, onTerm)}
        </Fragment>
      ))}
    </p>
  )
}

function isBullet(line: string): boolean {
  return /^\s*([-*•])\s+/.test(line)
}

function bulletText(line: string): string {
  return line.replace(/^\s*([-*•])\s+/, '')
}

/// Render a subset of Markdown as React elements.
///
/// Emits block elements (`p`, `ul`, `pre`), so its container must be a `div`
/// or similar — never a `p`, which the browser silently closes early.
export function Markdown({
  text,
  onTerm,
}: {
  text: string
  /// Called when the reader presses a `[[curiosity marker]]`. Omit it and the
  /// markers render as plain words.
  onTerm?: TermHandler
}): ReactNode {
  const source = (text ?? '').replace(/\r\n/g, '\n')
  if (!source.trim()) return null

  const lines = source.split('\n')
  const blocks: ReactNode[] = []
  let para: string[] = []
  let bullets: string[] = []

  const flushParagraph = () => {
    if (para.length > 0) {
      blocks.push(paragraph(para, `p${blocks.length}`, onTerm))
      para = []
    }
  }
  const flushBullets = () => {
    if (bullets.length > 0) {
      const key = `ul${blocks.length}`
      blocks.push(
        <ul className="md-list" key={key}>
          {bullets.map((b, i) => (
            <li key={i}>{inline(b, `${key}-${i}`, onTerm)}</li>
          ))}
        </ul>
      )
      bullets = []
    }
  }
  const flush = () => {
    flushParagraph()
    flushBullets()
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Fenced code. An unterminated fence runs to the end rather than being
    // dropped — losing the text would be worse than an over-long block.
    if (/^\s*```/.test(line)) {
      flush()
      const body: string[] = []
      i++
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        body.push(lines[i])
        i++
      }
      blocks.push(
        <pre className="md-code" key={`code${blocks.length}`}>
          {body.join('\n')}
        </pre>
      )
      continue
    }

    if (line.trim() === '') {
      flush()
      continue
    }

    if (isBullet(line)) {
      flushParagraph()
      bullets.push(bulletText(line))
      continue
    }

    // A heading has no place in a three-sentence remark, but models emit them
    // anyway. Render the text in bold rather than showing the hashes.
    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line)
    if (heading) {
      flush()
      blocks.push(
        <p className="md-p" key={`h${blocks.length}`}>
          <strong>{inline(heading[1], `h${blocks.length}`, onTerm)}</strong>
        </p>
      )
      continue
    }

    flushBullets()
    para.push(line)
  }
  flush()

  return <>{blocks}</>
}
