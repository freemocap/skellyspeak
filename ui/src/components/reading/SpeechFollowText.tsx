import { createContext, useContext, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { getSpeechFollow, subscribeSpeechFollow } from '../../platform/audio/speech-follow'
import { spokenRangeInText } from '../../domain/audio/speech-follow'

const InsideFollowText = createContext(false)

/** Source-only ranges preserve shaping, word help, selection and line wrapping. */
export function SpeechFollowText({ text, children, source }: { text: string; children: ReactNode; source?: { text: string; start: number } }) {
  const nested = useContext(InsideFollowText)
  // Portal excerpts have their own source occurrence and visual boundary.
  return nested && !source ? children : <FollowText text={text} source={source}>{children}</FollowText>
}

function FollowText({ text, children, source }: { text: string; children: ReactNode; source?: { text: string; start: number } }) {
  const select = (value: NonNullable<ReturnType<typeof getSpeechFollow>>) => {
    if (source && value.text === source.text) {
      const start = value.word.start - source.start, end = value.word.end - source.start
      return start >= 0 && end <= text.length ? { start, end } : null
    }
    return spokenRangeInText(text, value.text, value.word)
  }
  const follow = useSyncExternalStore(subscribeSpeechFollow, () => {
    const value = getSpeechFollow()
    return value && select(value) ? value : null
  }, () => null)
  const host = useRef<HTMLSpanElement>(null)
  const [{ rects, motion }, setGeometry] = useState<{ rects: DOMRect[]; motion: 'word' | 'layout' }>({ rects: [], motion: 'word' })
  // Keep invisible geometry through timing gaps so the next word can slide from
  // the previous position. Different source text must start with fresh geometry.
  useLayoutEffect(() => { setGeometry({ rects: [], motion: 'word' }) }, [text, source?.text, source?.start])
  useLayoutEffect(() => {
    const root = host.current
    if (!root || !follow) return
    const selected = select(follow)
    if (!selected) { setGeometry({ rects: [], motion: 'word' }); return }
    const { start, end } = selected
    const measure = (animate = false) => {
      const nodes = Array.from(root.querySelectorAll('[data-speech-source]')).filter(element => {
        const helper = element.closest('[data-reading-tools], .saved-word-help, dialog')
        return !helper || !root.contains(helper)
      })
        .flatMap(element => Array.from(element.childNodes).filter((node): node is Text => node.nodeType === Node.TEXT_NODE))
      if (nodes.map(node => node.data).join('') !== text) { setGeometry({ rects: [], motion: 'word' }); return }
      let cursor = 0
      const boxes: DOMRect[] = []
      for (const node of nodes) {
        const next = cursor + node.length
        if (start < next && end > cursor) {
          const range = document.createRange()
          range.setStart(node, Math.max(0, start - cursor)); range.setEnd(node, Math.min(node.length, end - cursor))
          boxes.push(...Array.from(range.getClientRects()).filter(rect => rect.width > 0 && rect.height > 0))
        }
        cursor = next
      }
      let left = 0, top = 0, right = window.innerWidth, bottom = window.innerHeight
      for (let ancestor = root.parentElement; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor), bounds = ancestor.getBoundingClientRect()
        if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { left = Math.max(left, bounds.left); right = Math.min(right, bounds.right) }
        if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom) }
      }
      const next = boxes.map(box => new DOMRect(Math.max(left, box.left), Math.max(top, box.top), Math.min(right, box.right) - Math.max(left, box.left), Math.min(bottom, box.bottom) - Math.max(top, box.top))).filter(box => box.width > 0 && box.height > 0)
      setGeometry(previous => {
        if (previous.rects.length === next.length && previous.rects.every((box, i) => box.x === next[i].x && box.y === next[i].y && box.width === next[i].width && box.height === next[i].height)) return previous
        return { rects: next, motion: animate ? 'word' : 'layout' }
      })
    }
    measure(true)
    const reposition = () => measure()
    const resize = new ResizeObserver(reposition); resize.observe(root); if (root.parentElement) resize.observe(root.parentElement)
    window.addEventListener('resize', reposition); window.addEventListener('scroll', reposition, true)
    window.visualViewport?.addEventListener('resize', reposition)
    window.visualViewport?.addEventListener('scroll', reposition)
    return () => {
      resize.disconnect(); window.removeEventListener('resize', reposition); window.removeEventListener('scroll', reposition, true)
      window.visualViewport?.removeEventListener('resize', reposition)
      window.visualViewport?.removeEventListener('scroll', reposition)
    }
  }, [follow, text, children, source?.text, source?.start])
  return <InsideFollowText value={true}><span ref={host}>{children}</span>
    {rects.length > 0 && createPortal(<div aria-hidden="true" className="speech-follow-overlay" data-active={follow !== null} data-motion={motion}>{rects.map((rect, i) => <div key={i} className="speech-follow-word" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} />)}</div>, host.current?.closest('dialog, [popover]') ?? document.body)}
  </InsideFollowText>
}
