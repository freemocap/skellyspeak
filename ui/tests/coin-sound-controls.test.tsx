// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CoinSoundControls } from '../tools/CoinSoundControls'
import { playRewardSound } from '../src/platform/audio/reward-sounds'
vi.mock('../src/platform/audio/reward-sounds', () => ({
  configureCoinVoice: vi.fn(), configureRewardSounds: vi.fn(), playRewardSound: vi.fn(),
  setRewardVolume: vi.fn(), stopRewardSounds: vi.fn(), unlockRewardAudio: vi.fn(),
}))
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks() })
afterEach(() => vi.useRealTimers())
it('starts with autoplay off and plays twelve points on explicit request', () => {
  render(<CoinSoundControls enabled volume={.2} onVolume={() => {}} />)
  expect(screen.getByLabelText('Autoplay preview')).not.toBeChecked()
  fireEvent.change(screen.getByRole('slider', { name: 'Notes per coin' }), { target: { value: '3' } })
  act(() => vi.advanceTimersByTime(2000))
  expect(playRewardSound).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('Play 12 XP'))
  act(() => vi.advanceTimersByTime(2000))
  expect(playRewardSound).toHaveBeenCalledTimes(12)
})
it('debounces setting edits and cancels pending autoplay when switched off', () => {
  render(<CoinSoundControls enabled volume={.2} onVolume={() => {}} />)
  fireEvent.click(screen.getByLabelText('Autoplay preview'))
  for (const value of ['3', '4', '5']) {
    fireEvent.change(screen.getByRole('slider', { name: 'Notes per coin' }), { target: { value } })
    act(() => vi.advanceTimersByTime(100))
  }
  expect(playRewardSound).not.toHaveBeenCalled()
  act(() => vi.advanceTimersByTime(2000))
  expect(playRewardSound).toHaveBeenCalledTimes(12)
  fireEvent.click(screen.getByText('Bell'))
  fireEvent.click(screen.getByLabelText('Autoplay preview'))
  act(() => vi.advanceTimersByTime(2000))
  expect(playRewardSound).toHaveBeenCalledTimes(12)
})
