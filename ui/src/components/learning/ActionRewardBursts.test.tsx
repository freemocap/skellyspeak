// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ActionRewardBursts } from './ActionRewardBursts'
import { bindRewardOrigin, publishEffortAwards } from '../../platform/ipc/reward-origin'
import type { EffortAward } from '../../generated/contracts'
let reduced = false
beforeEach(() => {
  vi.useFakeTimers(); reduced = false
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: reduced })))
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })
function earn(id: string) {
  fireEvent.click(document.body, { detail: 1, clientX: 142, clientY: 253 })
  bindRewardOrigin(id)
  act(() => publishEffortAwards([{ id, sourceId: id, dimension: 'bot', createdAt: new Date().toISOString() } as EffortAward]))
}
it('renders the matching icon explosion at the activation point, then removes it', () => {
  render(<ActionRewardBursts enabled />)
  earn('render-bot')
  const burst = document.querySelector('.action-reward-burst')!
  expect(burst).toHaveAttribute('data-unit', 'bot')
  expect(burst).toHaveAttribute('aria-hidden', 'true')
  expect(burst).toHaveStyle({ left: '142px', top: '253px' })
  expect(burst.querySelectorAll('svg')).toHaveLength(7)
  act(() => vi.advanceTimersByTime(850))
  expect(document.querySelector('.action-reward-burst')).toBeNull()
})
it('honors disabled effects and reduced motion', () => {
  const view = render(<ActionRewardBursts enabled={false} />)
  earn('disabled')
  expect(document.querySelector('.action-reward-burst')).toBeNull()
  view.rerender(<ActionRewardBursts enabled />)
  reduced = true; earn('reduced')
  expect(document.querySelector('.action-reward-burst')).toBeNull()
})
