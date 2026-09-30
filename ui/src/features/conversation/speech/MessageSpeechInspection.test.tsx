// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { AudioInspection } from '../../../generated/contracts'
import fixture from '../../../../tools/spectrogram-fixture.json'
import { MessageSpeechInspection, type MessageSpeechPlayback } from './MessageSpeechInspection'

const native = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('../../../platform/ipc/native', () => ({ invoke: native.invoke }))
vi.mock('../../../components/media/useAudibleScrub', () => ({ useAudibleScrub: () => ({ start: vi.fn(), move: vi.fn(), end: vi.fn() }) }))

function speech(): MessageSpeechPlayback {
  return { retained: { sessionId: 'session', audio: { status: 'ready', operationId: 'speech', attemptId: 'attempt', messageId: 'reply', mime: 'audio/wav', audioBase64: 'audio', alignment: null } },
    time: 0.5, playing: false, enabled: true, rate: 1, volume: 1, seek: vi.fn(), stop: vi.fn(), toggle: vi.fn() }
}
beforeEach(() => {
  native.invoke.mockReset().mockResolvedValue(fixture[0] as unknown as AudioInspection)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
})

it('shows preparation rather than unavailable audio while waiting for the reply audio', () => {
  render(<MessageSpeechInspection speech={{ ...speech(), retained: null, preparing: true }} text="Reply" />)
  expect(screen.getByRole('status')).toHaveTextContent('Preparing audio…')
  expect(screen.queryByText('Recording audio unavailable.')).toBeNull()
  expect(native.invoke).not.toHaveBeenCalled()
})

it('inspects the exact retained attempt locally and shares the playback clock with the expanded view', async () => {
  const playback = speech()
  render(<MessageSpeechInspection speech={playback} text="Reply" />)
  await screen.findByRole('slider', { name: 'Playback position' })
  expect(native.invoke).toHaveBeenCalledExactlyOnceWith('inspect_message_speech', { sessionId: 'session', operationId: 'speech', attemptId: 'attempt', audioBase64: 'audio', speechAlignment: null })
  expect(playback.toggle).not.toHaveBeenCalled()
  fireEvent.keyDown(screen.getByRole('slider', { name: 'Playback position' }), { key: 'ArrowRight' })
  expect(playback.seek).toHaveBeenCalledWith(0.6)
  fireEvent.click(screen.getByRole('button', { name: 'Recording inspection' }))
  expect(screen.getByRole('dialog')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Play' }))
  expect(playback.toggle).toHaveBeenCalledOnce()
  expect(native.invoke).toHaveBeenCalledOnce()
})

it('shows inspection failure and retries only local analysis', async () => {
  native.invoke.mockRejectedValueOnce(new Error('Analysis failed'))
  render(<MessageSpeechInspection speech={speech()} text="Reply" />)
  fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
  await screen.findByRole('slider', { name: 'Playback position' })
  expect(native.invoke).toHaveBeenCalledTimes(2)
})

it('discards late inspection when a different reply owns the retained audio', async () => {
  let resolve!: (value: unknown) => void
  native.invoke.mockImplementationOnce(() => new Promise(done => { resolve = done }))
  const playback = speech()
  const view = render(<MessageSpeechInspection speech={playback} text="Reply" />)
  await waitFor(() => expect(native.invoke).toHaveBeenCalledOnce())
  view.rerender(<MessageSpeechInspection speech={{ ...playback, retained: null }} text="Reply" />)
  resolve(fixture[0])
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Recording audio unavailable.'))
  expect(screen.queryByRole('slider')).toBeNull()
})


it('reopens without another inspection request or loading state, including after remount', async () => {
  const playback = speech()
  const view = render(<MessageSpeechInspection speech={playback} text="Reply" />)
  await screen.findByRole('slider', { name: 'Playback position' })
  view.rerender(<MessageSpeechInspection open={false} speech={playback} text="Reply" />)
  view.rerender(<MessageSpeechInspection speech={playback} text="Reply" />)
  expect(screen.queryByText('Loading…')).toBeNull()
  view.unmount()
  render(<MessageSpeechInspection speech={playback} text="Reply" />)
  expect(screen.queryByText('Loading…')).toBeNull()
  expect(native.invoke).toHaveBeenCalledOnce()
})
