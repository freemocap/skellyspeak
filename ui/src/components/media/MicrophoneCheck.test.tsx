// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MicrophoneCheck } from './MicrophoneCheck'
import { I18nProvider } from '../localization/i18n'
const invoke = vi.hoisted(() => vi.fn())
vi.mock('../../platform/ipc/native', () => ({ invoke }))
vi.mock('../../platform/diagnostics/faults', () => ({ reportFault: vi.fn() }))
vi.mock('../../platform/audio/browser-recording', () => ({ startBrowserRecording: vi.fn() }))

let samples: number[]
beforeEach(() => {
  vi.useFakeTimers(); invoke.mockReset(); samples = [0.2, -0.2]
  invoke.mockImplementation(async command => command === 'microphone_test_start'
    ? { browserCapture: false, deviceLabel: 'USB input' }
    : command === 'microphone_test_samples' ? samples : undefined)
})
afterEach(() => { vi.useRealTimers() })
const check = (props: Partial<Parameters<typeof MicrophoneCheck>[0]> = {}) => <I18nProvider locale="english"><MicrophoneCheck device="usb" {...props} /></I18nProvider>

it('is one quiet row until pressed: a Check button, an empty meter and no words', () => {
  const { container } = render(check())
  expect(screen.getByRole('button', { name: 'Check microphone' })).toBeEnabled()
  expect(screen.getByRole('meter', { name: 'Microphone level' })).toHaveAttribute('aria-valuenow', '0')
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
  expect(container.querySelector('.field-note')).toBeNull()
  expect(invoke).not.toHaveBeenCalled()
})

it('runs a local check: counts down, names the input, hears sound, then reports what it heard', async () => {
  render(check())
  fireEvent.click(screen.getByRole('button', { name: 'Check microphone' }))
  await act(async () => {})
  expect(invoke).toHaveBeenCalledWith('microphone_test_start', { testId: expect.any(String), device: 'usb' })
  expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Say something')
  expect(screen.getByRole('status')).toHaveTextContent('15 s')
  expect(screen.getByRole('status')).toHaveTextContent('USB input')
  expect(screen.getByText('Local check. Nothing is saved or uploaded.')).toBeInTheDocument()
  await act(async () => { await vi.advanceTimersByTimeAsync(1200) })
  expect(screen.getByRole('status')).toHaveTextContent('Hearing you')
  expect(screen.getByRole('status')).toHaveTextContent('14 s')
  expect(Number(screen.getByRole('meter', { name: 'Microphone level' }).getAttribute('aria-valuenow'))).toBeGreaterThan(0)
  await act(async () => { await vi.advanceTimersByTimeAsync(15000) })
  expect(screen.getByRole('button', { name: 'Check microphone' })).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Heard you')
  expect(screen.getByRole('status')).not.toHaveTextContent(/\d s/)
  expect(screen.queryByText('Local check. Nothing is saved or uploaded.')).toBeNull()
  expect(invoke).toHaveBeenCalledWith('microphone_test_stop', { testId: expect.any(String) })
})

it('says when nothing was heard', async () => {
  samples = [0, 0]
  render(check())
  fireEvent.click(screen.getByRole('button', { name: 'Check microphone' }))
  await act(async () => { await vi.advanceTimersByTimeAsync(4500) })
  expect(screen.getByRole('status')).toHaveTextContent('No sound. Check mute or move closer.')
  await act(async () => { await vi.advanceTimersByTimeAsync(11000) })
  expect(screen.getByRole('status')).toHaveTextContent('No sound heard')
})

it('stays available while idle only when its owner allows capture', () => {
  render(check({ disabled: true }))
  expect(screen.getByRole('button', { name: 'Check microphone' })).toBeDisabled()
})

it('shows a start failure beside the row and stays ready to try again', async () => {
  invoke.mockRejectedValueOnce(new Error('Permission denied'))
  render(check())
  fireEvent.click(screen.getByRole('button', { name: 'Check microphone' }))
  await act(async () => {})
  expect(screen.getByRole('alert')).toHaveTextContent('Permission denied')
  expect(screen.getByRole('button', { name: 'Check microphone' })).toBeEnabled()
})

it('starts at once when its owner opens it for a check, unless capture is unavailable', async () => {
  const { MicrophoneCheckStart } = await import('./MicrophoneCheck')
  const view = render(<I18nProvider locale="english"><MicrophoneCheckStart.Provider value={true}><MicrophoneCheck device="usb" /></MicrophoneCheckStart.Provider></I18nProvider>)
  await act(async () => {})
  expect(invoke).toHaveBeenCalledWith('microphone_test_start', { testId: expect.any(String), device: 'usb' })
  expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
  view.unmount()
  await act(async () => {})
  invoke.mockClear()
  render(<I18nProvider locale="english"><MicrophoneCheckStart.Provider value={true}><MicrophoneCheck device="usb" disabled /></MicrophoneCheckStart.Provider></I18nProvider>)
  await act(async () => {})
  expect(invoke).not.toHaveBeenCalled()
})
