// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { RecordDock, type DockPhase } from './RecordDock'
import { I18nProvider } from '../../components/localization/i18n'
import { CONTINUOUS_RECORDING_POLICY as policy } from '../../generated/contracts'

vi.mock('../../components/media/LiveRecording', () => ({ LiveRecording: () => null }))

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})

const view = (phase: DockPhase, empty = false) => <I18nProvider locale="english"><RecordDock phase={phase} empty={empty} mode="live"
  onMode={() => {}} settings={{ pauseMs: policy.defaultPauseMs, thresholdDb: policy.defaultThresholdDb,
    minTakeMs: policy.defaultMinTakeMs, silenceTimeoutMs: policy.defaultSilenceTimeoutMs }}
  onSettings={() => {}} listeningStatus={null} waveSource={null} spectrum={null}
  onToggle={() => {}} onHoldStart={() => {}} onHoldEnd={() => {}} /></I18nProvider>

it('keeps the pad and the control row mounted when capture starts and stops', () => {
  const { container, rerender } = render(view('ready'))
  const pad = screen.getByRole('button', { name: 'Start recording' })
  const controls = Array.from(container.querySelector('.voice-controls')!.children)
  expect(screen.getByText('Press the microphone to start')).toBeInTheDocument()
  rerender(view('recording'))
  expect(screen.getByRole('button', { name: 'Stop recording' })).toBe(pad)
  expect(pad).toHaveAttribute('data-live', 'true')
  expect(Array.from(container.querySelector('.voice-controls')!.children)).toEqual(controls)
  rerender(view('ready'))
  expect(screen.getByRole('button', { name: 'Start recording' })).toBe(pad)
  expect(Array.from(container.querySelector('.voice-controls')!.children)).toEqual(controls)
})

it('stays the same panel with no cards: capture is off and the stream says to add one', () => {
  const { container } = render(view('ready', true))
  expect(screen.getByRole('button', { name: 'Start recording' })).toBeDisabled()
  for (const mode of within(screen.getByRole('radiogroup', { name: 'Recording mode' })).getAllByRole('radio')) expect(mode).toBeDisabled()
  expect(screen.getByRole('checkbox', { name: 'Detect attempts' })).toBeDisabled()
  expect(container.querySelector('.voice-face')).toHaveTextContent('Add a practice card to record.')
  expect(screen.getByRole('status')).toHaveTextContent('Add a practice card to record.')
  expect(screen.queryByText('Press the microphone to start')).toBeNull()
  // Choosing a microphone needs no card.
  expect(screen.getByRole('button', { name: 'Recording settings' })).toBeEnabled()
})

it('shows Tap, Hold and Auto under the pad, the Auto controls in the row, and timings in settings', () => {
  const { container } = render(view('ready'))
  const group = screen.getByRole('radiogroup', { name: 'Recording mode' })
  expect(within(group).getAllByRole('radio')).toHaveLength(3)
  expect(within(group).getByRole('radio', { name: 'Auto' })).toHaveAttribute('aria-checked', 'true')
  expect(screen.getByRole('checkbox', { name: 'Detect attempts' })).toBeChecked()
  expect(screen.getByRole('meter', { name: 'Microphone level' })).toBeInTheDocument()
  expect(container.querySelectorAll('.voice-pad')).toHaveLength(1)
  expect(screen.queryByRole('button', { name: 'Discard current take' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Recording settings' }))
  const dialog = screen.getByRole('dialog', { name: 'Recording settings' })
  expect(within(dialog).getByRole('radiogroup', { name: 'End an attempt after silence of' })).toBeInTheDocument()
  expect(within(dialog).getByRole('radiogroup', { name: 'Ignore sounds shorter than' })).toBeInTheDocument()
  expect(within(dialog).queryByRole('radiogroup', { name: 'Recording mode' })).toBeNull()
})

it('puts the button on the chosen side and offers both layout settings', async () => {
  const layout = { padSide: 'left' as const, onPadSide: vi.fn(), time: 'rtl' as const, onTime: vi.fn() }
  const { container } = render(<I18nProvider locale="english"><RecordDock phase="ready" mode="tap" layout={layout}
    onMode={() => {}} settings={{ pauseMs: policy.defaultPauseMs, thresholdDb: policy.defaultThresholdDb,
      minTakeMs: policy.defaultMinTakeMs, silenceTimeoutMs: policy.defaultSilenceTimeoutMs }}
    onSettings={() => {}} listeningStatus={null} waveSource={null} spectrum={null}
    onToggle={() => {}} onHoldStart={() => {}} onHoldEnd={() => {}} /></I18nProvider>)
  const panel = container.querySelector('.drill-voice')!
  // In a left-to-right interface the left side is the inline start.
  expect(panel).toHaveAttribute('data-pad-side', 'left')
  expect(panel).toHaveAttribute('data-pad', 'start')
  fireEvent.click(screen.getByRole('button', { name: 'Recording settings' }))
  const settings = await screen.findByRole('dialog', { name: 'Recording settings' })
  fireEvent.click(within(within(settings).getByRole('radiogroup', { name: 'Microphone button' })).getByRole('radio', { name: 'Right' }))
  expect(layout.onPadSide).toHaveBeenCalledExactlyOnceWith('right')
  fireEvent.click(within(within(settings).getByRole('radiogroup', { name: 'Time direction' })).getByRole('radio', { name: 'Time →' }))
  expect(layout.onTime).toHaveBeenCalledExactlyOnceWith('ltr')
  expect(layout.onPadSide).toHaveBeenCalledOnce()
})
