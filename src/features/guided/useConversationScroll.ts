import { useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'

/** Keep the reading position when older pages arrive; follow the tail only while already there. */
export function useConversationScroll(element: RefObject<HTMLDivElement | null>, chatId: string | null, firstSequence: number | undefined, revision: unknown) {
  const position = useRef<{ chatId: string | null; first: number | undefined; height: number; top: number; atBottom: boolean } | null>(null)
  const onScroll = () => {
    const node = element.current
    if (!node || !position.current) return
    position.current.top = node.scrollTop
    position.current.height = node.scrollHeight
    position.current.atBottom = node.scrollHeight - node.clientHeight - node.scrollTop < 32
  }
  useLayoutEffect(() => {
    const node = element.current
    if (!node) return
    const previous = position.current
    if (firstSequence === undefined) node.scrollTop = 0
    else if (!previous || previous.chatId !== chatId || previous.first === undefined) node.scrollTop = node.scrollHeight
    else if (firstSequence !== undefined && previous.first !== undefined && firstSequence < previous.first) node.scrollTop = previous.top + node.scrollHeight - previous.height
    else if (previous.atBottom) node.scrollTop = node.scrollHeight
    position.current = { chatId, first: firstSequence, height: node.scrollHeight, top: node.scrollTop, atBottom: node.scrollHeight - node.clientHeight - node.scrollTop < 32 }
  }, [chatId, firstSequence, revision, element])
  return onScroll
}
