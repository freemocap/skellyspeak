// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { MicrophoneSelector } from './MicrophoneSelector'
const list = vi.hoisted(() => vi.fn())
vi.mock('../../platform/audio/microphones', () => ({ listMicrophones: list }))
vi.mock('../../platform/diagnostics/faults', () => ({ reportFault: vi.fn() }))

it('acknowledges refresh immediately, blocks repeats and unlocks after failure', async () => {
  list.mockResolvedValueOnce({ devices: [] })
  let fail!: (error: Error) => void
  list.mockImplementationOnce(() => new Promise((_, reject) => { fail = reject }))
  render(<MicrophoneSelector value={null} onChange={vi.fn()} />)
  const refresh = await screen.findByRole('button', { name: 'Refresh microphones' })
  await act(async () => {})
  fireEvent.click(refresh)
  expect(refresh).toBeDisabled()
  expect(refresh).toHaveAttribute('aria-busy', 'true')
  fireEvent.click(refresh)
  expect(list).toHaveBeenCalledTimes(2)
  await act(async () => fail(new Error('Microphone access denied')))
  expect(refresh).toBeEnabled()
  expect(screen.getByText('Microphone access denied')).toBeInTheDocument()
})
