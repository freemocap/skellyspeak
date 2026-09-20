import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useReadingActions, useReadingScope, type ReadingSelection } from './ReadingContext'
import { languageFor } from '../../platform/ipc/tauri'
import { readingWords, readingPassage } from '../../domain/reading/word-boundaries'
import { WordHoverHelp } from './WordHoverHelp'

function ReadingWord({ text, selection }: { text: string; selection: ReadingSelection }) {
  const anchor = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancel = useCallback(() => { if (timer.current !== null) clearTimeout(timer.current); timer.current = null }, [])
  const close = useCallback(() => { cancel(); setOpen(false); setPinned(false) }, [cancel])
  useEffect(() => cancel, [cancel])
  const enter = () => { cancel(); if (!open) timer.current = setTimeout(() => setOpen(true), 300) }
  const leave = () => { cancel(); if (!pinned) timer.current = setTimeout(close, 200) }
  const toggle = () => { cancel(); if (pinned) close(); else { setPinned(true); setOpen(true) } }
  return <><span ref={anchor} className="reading-word" role="button" tabIndex={0} aria-expanded={open}
    onPointerEnter={event => { if (event.pointerType === 'mouse') enter() }} onPointerLeave={leave}
    onPointerDown={cancel}
    onClick={event => {
      event.stopPropagation()
      const selected = window.getSelection()
      if (selected && !selected.isCollapsed && anchor.current?.contains(selected.anchorNode)) return
      toggle()
    }}
    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); toggle() } }}>{text}</span>
    {open && <WordHoverHelp selection={selection} anchor={anchor} pinned={pinned} onEnter={cancel} onLeave={leave} onClose={close} />}</>
}

/** Word boundaries add actions without changing the source's inline typography. */
export function UnannotatedText({ text, interactive = true, inline = false }: { text: string; interactive?: boolean; inline?: boolean }) {
  const actions = useReadingActions()
  const scope = useReadingScope()
  const locale = scope ? languageFor(scope.language, scope.variety ?? undefined)?.languageTag : undefined
  const parts = useMemo(() => readingWords(text, locale).map(part => ({ ...part, selection: scope ? { ...readingPassage(text, part.start, part.end, locale), scope } : null })), [text, locale, scope])
  if (!interactive || !actions || !scope) return <span className={inline ? undefined : "target-text"} dir={inline ? undefined : "auto"}>{text}</span>
  return <span className={inline ? undefined : "target-text"} dir={inline ? undefined : "auto"} lang={locale} data-reading-language={scope.language} data-reading-variety={scope.variety ?? undefined}>{parts.map(part => part.word
    ? <ReadingWord key={part.start} text={text.slice(part.start, part.end)} selection={part.selection!} />
    : <Fragment key={part.start}>{text.slice(part.start, part.end)}</Fragment>)}</span>
}
