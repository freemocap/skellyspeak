// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { PlaybackCursor } from './PlaybackCursor'

it('seeks through the displayed warp while dragging, and supports RTL keyboard seeking', () => {
  const onSeek = vi.fn()
  const view = render(<div><PlaybackCursor time={2} duration={10} displayDuration={20}
    mapTime={time => time * 2} direction="ltr" label="Attempt" onSeek={onSeek} /></div>)
  const cursor = screen.getByRole('slider')
  vi.spyOn(cursor.parentElement!, 'getBoundingClientRect').mockReturnValue({ left: 100, width: 200 } as DOMRect)
  cursor.setPointerCapture = vi.fn()
  cursor.hasPointerCapture = () => true
  cursor.releasePointerCapture = vi.fn()
  // MouseEvent supplies coordinates in environments without PointerEvent.
  fireEvent(cursor, new MouseEvent('pointerdown', { bubbles: true, clientX: 150 }))
  expect(onSeek.mock.lastCall![0]).toBeCloseTo(2.5)
  fireEvent(cursor, new MouseEvent('pointermove', { bubbles: true, clientX: 250 }))
  expect(onSeek.mock.lastCall![0]).toBeCloseTo(7.5)
  view.rerender(<div><PlaybackCursor time={2} duration={10} displayDuration={20}
    mapTime={time => time * 2} direction="rtl" label="Attempt" onSeek={onSeek} /></div>)
  fireEvent(cursor, new MouseEvent('pointermove', { bubbles: true, clientX: 250 }))
  expect(onSeek.mock.lastCall![0]).toBeCloseTo(2.5)
  view.rerender(<div><PlaybackCursor time={2} duration={10} direction="rtl" label="Attempt" onSeek={onSeek} /></div>)
  fireEvent.keyDown(cursor, { key: 'ArrowRight' })
  expect(onSeek).toHaveBeenLastCalledWith(1.9)
  fireEvent.keyDown(cursor, { key: 'End' })
  expect(onSeek).toHaveBeenLastCalledWith(10)
})

it('keeps clicks silent, previews movement, and ends the preview on release or cancellation', () => {
  const onSeek = vi.fn(), onScrub = vi.fn(), onScrubEnd = vi.fn()
  render(<div><PlaybackCursor time={0} duration={10} direction="ltr" label="Attempt"
    onSeek={onSeek} onScrub={onScrub} onScrubEnd={onScrubEnd} /></div>)
  const cursor = screen.getByRole('slider')
  vi.spyOn(cursor.parentElement!, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 100 } as DOMRect)
  cursor.setPointerCapture = vi.fn()
  cursor.hasPointerCapture = () => true
  cursor.releasePointerCapture = vi.fn()
  fireEvent(cursor, new MouseEvent('pointerdown', { bubbles: true, clientX: 25 }))
  expect(onSeek).toHaveBeenLastCalledWith(2.5)
  expect(onScrub).not.toHaveBeenCalled()
  fireEvent(cursor, new MouseEvent('pointermove', { bubbles: true, clientX: 50 }))
  expect(onScrub).toHaveBeenLastCalledWith(5, expect.any(Number))
  fireEvent.pointerUp(cursor)
  expect(onScrubEnd).toHaveBeenCalledOnce()
  fireEvent.lostPointerCapture(cursor)
  expect(onScrubEnd).toHaveBeenCalledOnce()
  fireEvent(cursor, new MouseEvent('pointerdown', { bubbles: true, clientX: 25 }))
  fireEvent.pointerCancel(cursor)
  expect(onScrubEnd).toHaveBeenCalledTimes(2)
})
