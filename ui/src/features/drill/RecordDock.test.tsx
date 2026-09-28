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

const view = (phase: DockPhase) => <I18nProvider locale="english"><RecordDock phase={phase} mode="live"
  onMode={() => {}} settings={{ pauseMs: policy.defaultPauseMs, thresholdDb: policy.defaultThresholdDb,
    minTakeMs: policy.defaultMinTakeMs, silenceTimeoutMs: policy.defaultSilenceTimeoutMs }}
  onSettings={() => {}} listeningStatus={null} waveSource={null} liveSpectrum={null}
  onToggle={() => {}} onHoldStart={() => {}} onHoldEnd={() => {}} /></I18nProvider>

it('keeps the control rows and record node mounted when capture starts and stops', () => {
  const { container, rerender } = render(view('ready'))
  const button = screen.getByRole('button', { name: 'Start recording' })
  const rows = Array.from(container.querySelector('.drill-dock-side')!.children)
  expect(screen.queryByRole('button', { name: 'Discard current take' })).toBeNull()
  expect(container.querySelector('.drill-dock-counts')).toHaveTextContent('0 queued')
  rerender(view('recording'))
  expect(screen.getByRole('button', { name: 'Stop recording' })).toBe(button)
  expect(Array.from(container.querySelector('.drill-dock-side')!.children)).toEqual(rows)
  rerender(view('ready'))
  expect(screen.getByRole('button', { name: 'Start recording' })).toBe(button)
  expect(Array.from(container.querySelector('.drill-dock-side')!.children)).toEqual(rows)
})

it('keeps only the record action, auto toggle and settings outside the dialog', () => {
  const { container } = render(view('ready'))
  expect(screen.queryByRole('radio')).toBeNull()
  expect(screen.getByRole('checkbox', { name: 'Detect attempts' })).toBeChecked()
  expect(container.querySelectorAll('.drill-dock-button')).toHaveLength(1)
  expect(screen.queryByRole('button', { name: 'Discard current take' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Recording settings' }))
  const group = screen.getByRole('radiogroup', { name: 'Recording mode' })
  expect(within(group).getAllByRole('radio')).toHaveLength(3)
  expect(within(group).getByRole('radio', { name: 'Auto' })).toHaveAttribute('aria-checked', 'true')
})
