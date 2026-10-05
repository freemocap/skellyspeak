// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { FaultBar } from './FaultBar'
import { useFaultStore } from '../../platform/diagnostics/faults'

vi.mock('../../components/feedback/ShareLogsButton', () => ({ ShareLogsButton: () => null }))
beforeEach(() => useFaultStore.setState({ faults: [{ id: 1, context: 'Microphone', message: 'ElevenLabs system_busy', diagnostics: { status: 429, message: 'Heavy traffic. Try again.' } }] }))

it('resizes the error panel by keyboard and keeps expanded diagnostics and dismissal available', () => {
  render(<FaultBar />)
  const handle = screen.getByRole('separator', { name: 'Resize panel' })
  const panel = handle.parentElement!
  expect(screen.getByRole('alert')).toHaveTextContent('Microphone: The AI service is busy Wait a few seconds, then try again.')
  expect(screen.getByText('ElevenLabs system_busy')).not.toBeVisible()
  fireEvent.click(screen.getByText('Technical details'))
  expect(screen.getByText('Technical details').parentElement).toHaveAttribute('open')
  expect(screen.getByText('ElevenLabs system_busy')).toBeVisible()
  fireEvent.keyDown(handle, { key: 'End' })
  expect(panel.style.height).toBe(`${window.innerHeight * 0.85}px`)
  expect(screen.getByText(/Heavy traffic/)).toBeVisible()
  fireEvent.keyDown(handle, { key: 'Home' })
  expect(panel.style.height).toBe('80px')
  act(() => useFaultStore.getState().publish({ id: 2, context: 'Speech', message: 'Another failure' }))
  expect(panel.style.height).toBe('80px')
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss all' }))
  expect(screen.queryByRole('separator')).toBeNull()
})

it('shows a readable message as written and folds only machine output', () => {
  useFaultStore.setState({ faults: [
    { id: 1, context: 'Saving settings', message: 'The settings file is read-only.' },
    { id: 2, context: 'Speech', message: 'speech_stream: schema_mismatch at $.items[0]' },
  ] })
  render(<FaultBar />)
  expect(screen.getByText('The settings file is read-only.', { exact: false })).toBeVisible()
  expect(screen.getByText('speech_stream: schema_mismatch at $.items[0]')).not.toBeVisible()
  expect(screen.getAllByText('Technical details')).toHaveLength(1)
  expect(screen.getByRole('alert')).toHaveTextContent('Speech: Something went wrong Try again, and open the details if it keeps happening.')
})

it('supports pointer dragging with capture, and ignores movement before a drag', () => {
  render(<FaultBar />)
  const handle = screen.getByRole('separator')
  const panel = handle.parentElement!
  let captured = false
  handle.setPointerCapture = () => { captured = true }
  handle.hasPointerCapture = () => captured
  handle.releasePointerCapture = () => { captured = false }
  fireEvent.pointerMove(handle, { pointerId: 1, clientY: 300 })
  expect(panel.style.height).toBe('')
  fireEvent.pointerDown(handle, { pointerId: 1, button: 0 })
  fireEvent.pointerMove(handle, { pointerId: 1, clientY: 300 })
  expect(panel.style.height).toBe('300px')
  fireEvent.pointerUp(handle, { pointerId: 1 })
  fireEvent.pointerMove(handle, { pointerId: 1, clientY: 400 })
  expect(panel.style.height).toBe('300px')
})
