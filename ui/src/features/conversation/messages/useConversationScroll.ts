import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

const BOTTOM_SLACK = 32

/** Keep the reading position when older pages arrive; follow the tail only while
 * already there. While following, any growth inside the stream (a translation,
 * word meanings, fonts) keeps the tail in view. While reading earlier messages,
 * a change at the tail (`tail`) is reported as unseen instead of moving the page. */
export function useConversationScroll(element: RefObject<HTMLDivElement | null>, chatId: string | null, firstSequence: number | undefined, revision: unknown, tail: string | null) {
  const position = useRef<{ chatId: string | null; first: number | undefined; height: number; top: number; atBottom: boolean; tail: string | null } | null>(null)
  const [unseen, setUnseen] = useState(false)
  const record = useCallback((node: HTMLDivElement) => {
    if (!position.current) return
    position.current.top = node.scrollTop
    position.current.height = node.scrollHeight
    position.current.atBottom = node.scrollHeight - node.clientHeight - node.scrollTop < BOTTOM_SLACK
    if (position.current.atBottom) setUnseen(false)
  }, [])
  const onScroll = () => { if (element.current) record(element.current) }
  useLayoutEffect(() => {
    const node = element.current
    if (!node) return
    const previous = position.current
    if (firstSequence === undefined) node.scrollTop = 0
    else if (!previous || previous.chatId !== chatId || previous.first === undefined) node.scrollTop = node.scrollHeight
    else if (firstSequence !== undefined && previous.first !== undefined && firstSequence < previous.first) node.scrollTop = previous.top + node.scrollHeight - previous.height
    else if (previous.atBottom) node.scrollTop = node.scrollHeight
    const atBottom = node.scrollHeight - node.clientHeight - node.scrollTop < BOTTOM_SLACK
    const sameChat = previous !== null && previous.chatId === chatId
    if (!sameChat || atBottom) setUnseen(false)
    else if (previous.tail !== tail) setUnseen(true)
    position.current = { chatId, first: firstSequence, height: node.scrollHeight, top: node.scrollTop, atBottom, tail }
  }, [chatId, firstSequence, revision, tail, element])
  // Content can grow without a new turn: follow it only while pinned.
  useEffect(() => {
    const node = element.current
    if (!node || typeof ResizeObserver === 'undefined' || typeof MutationObserver === 'undefined') return
    const resize = new ResizeObserver(() => {
      if (position.current?.atBottom) node.scrollTop = node.scrollHeight
      record(node)
    })
    const observe = () => { for (const child of Array.from(node.children)) resize.observe(child) }
    resize.observe(node)
    observe()
    const children = new MutationObserver(observe)
    children.observe(node, { childList: true })
    return () => { resize.disconnect(); children.disconnect() }
  }, [element, record])
  const jumpToLatest = () => {
    const node = element.current
    if (!node) return
    node.scrollTop = node.scrollHeight
    record(node)
    setUnseen(false)
  }
  return { onScroll, unseen, jumpToLatest }
}
