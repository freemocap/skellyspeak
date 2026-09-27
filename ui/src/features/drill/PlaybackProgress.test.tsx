// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../components/localization/i18n'
import { PlaybackProgress } from './PlaybackProgress'

it.each(['ltr', 'rtl'] as const)('scrubs the displayed alignment in %s and ends audio preview once', direction => {
  const seek = vi.fn(), scrub = { start: vi.fn(), move: vi.fn(), end: vi.fn() }
  const view = render(<I18nProvider locale="english"><PlaybackProgress time={2} duration={10} displayDuration={20}
    mapTime={time => time * 2} direction={direction} label="Seek" onSeek={seek} scrub={scrub} /></I18nProvider>)
  expect(view.container.querySelector('.drill-playback-progress-fill')).toHaveStyle({ width: '20%' })
  const slider = screen.getByRole('slider')
  vi.spyOn(slider.parentElement!, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 200 } as DOMRect)
  slider.setPointerCapture = vi.fn()
  slider.hasPointerCapture = () => true
  slider.releasePointerCapture = vi.fn()
  fireEvent(slider, new MouseEvent('pointerdown', { bubbles: true, clientX: 50 }))
  expect(seek.mock.lastCall![0]).toBeCloseTo(direction === 'ltr' ? 2.5 : 7.5)
  fireEvent(slider, new MouseEvent('pointermove', { bubbles: true, clientX: 100 }))
  expect(scrub.move.mock.lastCall![0]).toBeCloseTo(5)
  fireEvent.pointerUp(slider)
  fireEvent.lostPointerCapture(slider)
  expect(scrub.end).toHaveBeenCalledOnce()
})
