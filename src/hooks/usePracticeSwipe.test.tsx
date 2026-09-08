// @vitest-environment jsdom
import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { usePracticeSwipe } from './usePracticeSwipe'

it('switches only for deliberate horizontal swipes outside controls and screen edges', () => {
  const change = vi.fn()
  function Fixture() { return <div {...usePracticeSwipe(change, true)}><p>Practice</p><input aria-label="Message" /></div> }
  render(<Fixture />)
  const swipe = (target: HTMLElement, x: number, y: number, endX: number, endY: number) => {
    fireEvent.touchStart(target, { touches: [{ clientX: x, clientY: y }] })
    fireEvent.touchEnd(target, { changedTouches: [{ clientX: endX, clientY: endY }] })
  }
  swipe(screen.getByText('Practice'), 240, 200, 80, 210)
  expect(change).toHaveBeenLastCalledWith('next')
  swipe(screen.getByText('Practice'), 80, 200, 240, 210)
  expect(change).toHaveBeenLastCalledWith('previous')
  swipe(screen.getByText('Practice'), 200, 200, 190, 400)
  swipe(screen.getByText('Practice'), 10, 200, 240, 210)
  swipe(screen.getByLabelText('Message'), 240, 200, 80, 210)
  expect(change).toHaveBeenCalledTimes(2)
})

it('swipes from chat to lesson and back across a lesson button without activating the card', () => {
  const activate = vi.fn()
  function Fixture() {
    const [surface, setSurface] = useState('chat')
    const swipe = usePracticeSwipe(direction => setSurface(direction === 'next' ? 'lesson' : 'chat'), true)
    return <div {...swipe}>{surface === 'chat' ? <p>Chat text</p> : <button onClick={activate}><span>Lesson card</span></button>}</div>
  }
  render(<Fixture />)
  const chat = screen.getByText('Chat text')
  fireEvent.touchStart(chat, { touches: [{ clientX: 240, clientY: 200 }] })
  fireEvent.touchEnd(chat, { changedTouches: [{ clientX: 80, clientY: 210 }] })
  const card = screen.getByText('Lesson card')
  fireEvent.touchStart(card, { touches: [{ clientX: 80, clientY: 200 }] })
  fireEvent.touchEnd(card, { changedTouches: [{ clientX: 240, clientY: 210 }] })
  expect(screen.getByText('Chat text')).toBeInTheDocument()
  expect(activate).not.toHaveBeenCalled()
})

it('preserves taps and vertical scrolling on lesson controls but suppresses the click following a swipe', () => {
  const activate = vi.fn()
  const change = vi.fn()
  function Fixture() { return <div {...usePracticeSwipe(change, true)}><button onClick={activate}>Lesson control</button></div> }
  render(<Fixture />)
  const card = screen.getByText('Lesson control')
  fireEvent.touchStart(card, { touches: [{ clientX: 80, clientY: 200 }] })
  fireEvent.touchEnd(card, { changedTouches: [{ clientX: 240, clientY: 210 }] })
  fireEvent.click(card, { detail: 1 })
  expect(change).toHaveBeenCalledWith('previous')
  expect(activate).not.toHaveBeenCalled()
  fireEvent.touchStart(card, { touches: [{ clientX: 80, clientY: 200 }] })
  fireEvent.touchEnd(card, { changedTouches: [{ clientX: 82, clientY: 202 }] })
  fireEvent.click(card, { detail: 1 })
  expect(activate).toHaveBeenCalledOnce()
  fireEvent.touchStart(card, { touches: [{ clientX: 80, clientY: 200 }] })
  fireEvent.touchEnd(card, { changedTouches: [{ clientX: 85, clientY: 400 }] })
  expect(change).toHaveBeenCalledOnce()
})
