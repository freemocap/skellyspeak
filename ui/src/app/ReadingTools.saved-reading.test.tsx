// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { Conversation, ConversationSnapshot, SavedGlossSource } from '../generated/contracts'
import { ReadingTools } from './ReadingTools'
import { ConversationReadingProvider } from '../features/conversation/reading/ConversationReadingProvider'
import { TargetText } from '../components/reading/TargetText'

const native = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('../platform/ipc/native', () => native)
vi.mock('../platform/ipc/tauri', () => ({
  languageFor: () => ({ languageTag: 'es' }),
  languages: () => [{ code: 'spanish', name: 'Spanish', defaultVariety: 'spain', varieties: [{ id: 'spain', label: 'Spain' }] }],
}))
const scope = { language: 'spanish', variety: 'spain', explanation: 'english', explanationVariety: 'us' }
const saved: SavedGlossSource = { sourceId: 'message', operationId: 'operation', attemptId: 'attempt', scope, text: 'La playa.', segments: [{ start: 3, end: 8, kind: 'gloss', gloss: 'beach' }] }
const snapshot = { conversationId: 'chat', coachMessages: [], messages: [{ id: 'message', text: saved.text, readingScope: scope, wordGloss: { targetLanguageId: 'spanish', explanationLanguageId: 'english', segments: saved.segments } }] } as unknown as ConversationSnapshot
const conversation = { id: 'chat', languageId: 'spanish', settings: { varietyId: 'spain', explanationLanguage: 'english', explanationVarietyId: 'us' } } as Conversation

beforeEach(() => {
  native.invoke.mockReset()
  native.invoke.mockImplementation(async command => {
    if (command === 'get_saved_gloss_sources') return [saved]
    throw new Error(`Unexpected command: ${command}`)
  })
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
})

it('reads persisted annotations after the conversation provider unmounts without requesting inference', async () => {
  const view = (chat: boolean) => <ReadingTools settings={null} defaultScope={scope} onAsk={null}>
    {chat ? <ConversationReadingProvider snapshot={snapshot} conversation={conversation}><TargetText text="Otra playa." /></ConversationReadingProvider> : <TargetText text="Otra playa." />}
  </ReadingTools>
  const { rerender } = render(view(true))
  fireEvent.click(screen.getByRole('button', { name: 'playa' }))
  expect(screen.getByText('beach')).toBeVisible()
  expect(native.invoke).not.toHaveBeenCalled()
  rerender(view(false))
  fireEvent.click(screen.getByRole('button', { name: 'playa' }))
  expect(await screen.findByText('beach')).toBeVisible()
  expect(native.invoke.mock.calls.map(([command]) => command)).toEqual(['get_saved_gloss_sources'])
  expect(native.invoke.mock.calls[0][1].query).toEqual({ scope, surfaces: ['Otra playa.', 'Otra', 'playa'] })
})

it('works on a fresh surface and re-queries accepted data instead of caching a stale projection', async () => {
  render(<ReadingTools settings={null} defaultScope={scope} onAsk={null}><TargetText text="playa" /></ReadingTools>)
  fireEvent.click(screen.getByRole('button', { name: 'playa' }))
  expect(await screen.findByText('beach')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'playa' }))
  native.invoke.mockResolvedValueOnce([{ ...saved, segments: [{ ...saved.segments[0], gloss: 'shore' }] }])
  fireEvent.click(screen.getByRole('button', { name: 'playa' }))
  expect(await screen.findByText('shore')).toBeVisible()
  expect(native.invoke.mock.calls.map(([command]) => command)).toEqual(['get_saved_gloss_sources', 'get_saved_gloss_sources'])
})

it('does not dispatch when a source closes while its saved lookup is pending', async () => {
  let release!: (value: SavedGlossSource[]) => void
  native.invoke.mockImplementation(() => new Promise(resolve => { release = resolve }))
  const view = render(<ReadingTools settings={null} defaultScope={scope} onAsk={null}><TargetText text="playa" /></ReadingTools>)
  fireEvent.click(screen.getByRole('button', { name: 'playa' }))
  await waitFor(() => expect(native.invoke).toHaveBeenCalledOnce())
  view.unmount()
  await act(async () => { release([]) })
  expect(native.invoke.mock.calls.map(([command]) => command)).toEqual(['get_saved_gloss_sources'])
})

it('reports lookup failures without silently submitting paid work', async () => {
  native.invoke.mockRejectedValue({ code: 'storage', message: 'Saved annotation lookup failed.' })
  render(<ReadingTools settings={null} defaultScope={scope} onAsk={null}><TargetText text="playa" /></ReadingTools>)
  fireEvent.click(screen.getByRole('button', { name: 'playa' }))
  expect(await screen.findByText('Saved annotation lookup failed.')).toBeVisible()
  expect(native.invoke).toHaveBeenCalledOnce()
})

it('requests inference for an unknown selected word even when another word has a saved meaning', async () => {
  native.invoke.mockImplementation(async command => {
    if (command === 'get_saved_gloss_sources') return [saved]
    if (command === 'begin_reading') return 'reading'
    if (command === 'run_reading') return { gloss: { coverage: 'complete', segments: [{ start: 0, end: 4, kind: 'gloss', gloss: 'another' }, { start: 5, end: 10, kind: 'gloss', gloss: 'beach' }] }, receipt: {} }
    if (command === 'cancel_reading') return
    throw new Error(command)
  })
  render(<ReadingTools settings={null} defaultScope={scope} onAsk={null}><TargetText text="Otra playa." /></ReadingTools>)
  fireEvent.click(screen.getByRole('button', { name: 'Otra' }))
  expect(await screen.findByText('another')).toBeVisible()
  expect(native.invoke.mock.calls.map(([command]) => command)).toEqual(['get_saved_gloss_sources', 'begin_reading', 'run_reading'])
})

it('shows partial accepted annotations in inspection and submits only when retry is explicit', async () => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  native.invoke.mockImplementation(async command => {
    if (command === 'get_saved_gloss_sources') return [saved]
    if (command === 'begin_reading') return 'reading'
    if (command === 'run_reading') return { gloss: { coverage: 'complete', segments: [{ start: 0, end: 4, kind: 'gloss', gloss: 'another' }, { start: 5, end: 10, kind: 'gloss', gloss: 'beach' }] }, receipt: {} }
    if (command === 'cancel_reading') return
    throw new Error(command)
  })
  render(<ReadingTools settings={null} defaultScope={scope} onAsk={null}><TargetText text="Otra playa." /></ReadingTools>)
  fireEvent.click(screen.getByRole('button', { name: 'playa' }))
  expect(await screen.findByText('beach')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Word help' }))
  const retry = await screen.findByRole('button', { name: 'Retry word meanings' })
  expect(native.invoke.mock.calls.every(([command]) => command === 'get_saved_gloss_sources')).toBe(true)
  fireEvent.click(retry)
  await waitFor(() => expect(native.invoke.mock.calls.filter(([command]) => command === 'run_reading')).toHaveLength(1))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Retry word meanings' })).toBeNull())
})
