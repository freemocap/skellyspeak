// @vitest-environment jsdom
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
