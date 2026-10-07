// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ReadingHelp } from './ReadingHelp'
import { ReadAloudSlotContext, useReadingActions, ReadingScopeContext, type ReadingServices } from './ReadingContext'
import type { ReadingResult } from '../../generated/contracts'

vi.mock('../../platform/ipc/tauri', () => ({ languageFor: () => ({ languageTag: 'es', romanization: null }) }))
const scope = { language: 'spanish', variety: 'spanish-spain', explanation: 'english', explanationVariety: 'english-us' }
const languages = [{ code: 'spanish', name: 'Spanish', languageTag: 'es', defaultVariety: 'spanish-spain', varieties: [{ id: 'spanish-spain', label: 'Spain' }] }]
const services: ReadingServices = { read: vi.fn(), speak: vi.fn(), activity: vi.fn() }
const selection = { scope, text: 'Hola', start: 0, end: 4 }
const status = () => document.querySelector('.reading-audio-status')

function Speak() {
  const actions = useReadingActions()
  return <button onClick={() => actions?.speak(selection)}>Speak</button>
}
function Inspect() {
  const actions = useReadingActions()
  return <button onClick={() => actions?.inspect(selection)}>Inspect</button>
}
function app(slot: HTMLElement | null = null) {
  return render(<ReadingScopeContext value={scope}><ReadAloudSlotContext value={slot}><ReadingHelp services={services} languages={languages}><Speak /><Inspect /></ReadingHelp></ReadAloudSlotContext></ReadingScopeContext>)
}

beforeEach(() => { vi.resetAllMocks() })

it('shows one line while speech loads and plays, then leaves on its own when playback ends', async () => {
  let playback!: () => void
  let finish!: (value: unknown) => void
  vi.mocked(services.speak).mockImplementation((_input, _signal, onPlayback) => new Promise(resolve => { playback = onPlayback; finish = resolve }))
  app()
  fireEvent.click(screen.getByRole('button', { name: 'Speak' }))
  expect(screen.getByRole('status')).toHaveTextContent('Loading speech…')
  expect(screen.getByRole('button', { name: 'Stop reading' })).toBeVisible()
  act(() => playback())
  expect(screen.getByRole('status')).toHaveTextContent('Reading aloud…')
  await act(async () => finish({ receipt: { requestId: 'speech-1' }, audioBase64: 'UklGRiQAAABXQVZF' }))
  expect(status()).toBeNull()
  expect(screen.queryByText('Response details')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
})

it('stops a loading request and removes the line', () => {
  vi.mocked(services.speak).mockImplementation(() => new Promise(() => {}))
  app()
  fireEvent.click(screen.getByRole('button', { name: 'Speak' }))
  fireEvent.click(screen.getByRole('button', { name: 'Stop reading' }))
  expect(vi.mocked(services.speak).mock.calls[0][1].aborted).toBe(true)
  expect(status()).toBeNull()
})

it('makes a recognised failure the card itself, with Retry and Close and no inner dismiss, and Close removes it whole', async () => {
  vi.mocked(services.speak).mockRejectedValue(new Error('Provider processing may have occurred; no automatic retry was made.'))
  app()
  fireEvent.click(screen.getByRole('button', { name: 'Speak' }))
  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('The connection dropped')
  expect(status()).toHaveAttribute('data-level', 'passing')
  expect(screen.queryByRole('button', { name: 'Dismiss error' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(status()).toBeNull()
  expect(screen.queryByRole('alert')).toBeNull()
})

it('shows a failure it cannot name as written, at the broke level', async () => {
  vi.mocked(services.speak).mockRejectedValue(new Error('Offline preview: no speech request was sent.'))
  app()
  fireEvent.click(screen.getByRole('button', { name: 'Speak' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Offline preview: no speech request was sent.')
  expect(status()).toHaveAttribute('data-level', 'broke')
})

it('retries the same selection from the failure card and leaves once the retry plays out', async () => {
  vi.mocked(services.speak).mockRejectedValueOnce(new Error('Speech unavailable')).mockResolvedValue({})
  app()
  fireEvent.click(screen.getByRole('button', { name: 'Speak' }))
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await waitFor(() => expect(services.speak).toHaveBeenCalledTimes(2))
  expect(vi.mocked(services.speak).mock.calls[1][0]).toEqual({ ...scope, text: 'Hola', aid: 'speech' })
  await waitFor(() => expect(status()).toBeNull())
})

it('rises in flow in the slot the app offers, as a phone\'s recording panel does, instead of floating', () => {
  const slot = document.createElement('div')
  document.body.append(slot)
  vi.mocked(services.speak).mockImplementation(() => new Promise(() => {}))
  try {
    app(slot)
    fireEvent.click(screen.getByRole('button', { name: 'Speak' }))
    const card = status()!
    expect(card.parentElement).toBe(slot)
    expect(card).not.toHaveAttribute('popover')
    expect(card).toHaveAttribute('data-placement', 'slot')
    expect(screen.getByRole('status')).toHaveTextContent('Loading speech…')
  } finally { slot.remove() }
})

it('floats bottom-right as a top-layer popover when no slot is offered', () => {
  vi.mocked(services.speak).mockImplementation(() => new Promise(() => {}))
  app()
  fireEvent.click(screen.getByRole('button', { name: 'Speak' }))
  const card = status()!
  expect(card.parentElement).toBe(document.body)
  expect(card).toHaveAttribute('popover', 'manual')
  expect(card).toHaveAttribute('data-placement', 'corner')
})

it('is hosted inside an open Word help dialog, where a modal cannot make it inert, and floats again once the dialog closes', async () => {
  vi.mocked(services.read).mockResolvedValue({ gloss: { coverage: 'complete', segments: [] }, audioBase64: null, receipt: null } as unknown as ReadingResult)
  vi.mocked(services.speak).mockRejectedValue(new Error('Speech unavailable'))
  app()
  fireEvent.click(screen.getByRole('button', { name: 'Inspect' }))
  const dialog = await screen.findByRole('dialog', { name: 'Word help' })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Read aloud: Hola' }))
  await screen.findByRole('alert')
  const card = status()!
  expect(dialog.contains(card)).toBe(true)
  expect(card).toHaveAttribute('popover', 'manual')
  expect(card).toHaveAttribute('data-placement', 'corner')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close Word help' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(status()!.parentElement).toBe(document.body)
  expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible()
})
