// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ReplyHelp } from './ReplyHelp'
import { ReadingHelp } from '../../../components/reading/ReadingHelp'
import { ReadingScopeContext, type ReadingServices } from '../../../components/reading/ReadingContext'
import { SavedReadingProvider } from '../../../components/reading/SavedReadingProvider'

vi.mock('../../../platform/ipc/tauri', () => ({ languageFor: () => ({ languageTag: 'es' }) }))

const scope = { language: 'spanish', variety: null, explanation: 'english', explanationVariety: null }
const completion = { gloss: null, translation: null, audioBase64: null, audioAlignment: null,
  explanations: { cards: [
    { quote: 'Quiero __.', title: 'Water', body: 'Ask for water.', example: 'Quiero agua.', contrast: '' },
    { quote: 'Quiero __.', title: 'Coffee', body: 'Ask for coffee.', example: 'Quiero café.', contrast: '' },
  ] }, receipt: { requestId: 'reading-request' } }
const services: ReadingServices = { read: vi.fn(), speak: vi.fn(), activity: vi.fn() }

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(services.read).mockResolvedValue(completion)
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})

function show(saved = false, starter = 'Quiero __.') {
  const onUse = vi.fn()
  const source = { scope, text: 'Quiero __.', segments: [
    { start: 0, end: 6, kind: 'gloss' as const, gloss: 'I want' },
    // Even an old, invalid annotation must not turn a slot into vocabulary.
    { start: 7, end: 9, kind: 'gloss' as const, gloss: 'incorrect meaning' },
  ] }
  render(<ReadingScopeContext value={scope}><ReadingHelp services={services} languages={[]}>
    <SavedReadingProvider sources={saved ? [source] : []}>
      <ReplyHelp inline opened={['replies']} busy={false} errors={[]} onUse={onUse}
        replies={[{ text: 'Quiero agua.', translation: 'I want water.', romanization: '', pronunciation: '' }]}
        starters={[starter]} />
    </SavedReadingProvider>
  </ReadingHelp></ReadingScopeContext>)
  return { onUse }
}

function tool(root: HTMLElement, name: string) {
  const inline = within(root).queryByRole('button', { name })
  if (inline) return inline
  fireEvent.click(within(root).getByRole('button', { name: 'More actions' }))
  return screen.getByRole('button', { name })
}

it.each(['.help-reply', '.help-starter'])('uses shared analysis, playback, reading and practice controls in %s', async selector => {
  const { onUse } = show()
  const root = document.querySelector(selector) as HTMLElement
  expect(root.querySelector('.msg.chat-message')).not.toBeNull()
  expect(services.read).not.toHaveBeenCalled()
  expect(tool(root, 'Play')).toBeEnabled()
  expect(tool(root, 'Translate')).toBeEnabled()
  expect(tool(root, 'Add to Practice')).toBeEnabled()
  expect(tool(root, 'Words')).toBeEnabled()
  fireEvent.click(tool(root, 'Analysis'))
  const text = selector === '.help-reply' ? 'Quiero agua.' : 'Quiero __.'
  await waitFor(() => expect(services.read).toHaveBeenCalledWith({ ...scope, text, aid: selector === '.help-reply' ? 'explanations' : 'completions' }, expect.any(AbortSignal)))
  expect(screen.getByRole('dialog', { name: 'Message analysis' })).toHaveTextContent('Ask for water.')
  fireEvent.click(screen.getByRole('button', { name: 'Close Message analysis' }))
  fireEvent.click(within(root).getByRole('button', { name: selector === '.help-reply' ? 'Insert reply: Quiero agua.' : 'Insert starter: Quiero __.' }))
  expect(onUse).toHaveBeenCalledWith(text, selector === '.help-reply' ? 'suggestion' : 'scaffold')
})

it.each([false, true])('requests contextual completions for a blank, including with saved annotations (%s)', async saved => {
  show(saved)
  expect(services.read).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '__' }))
  await waitFor(() => expect(services.read).toHaveBeenCalledExactlyOnceWith({ ...scope, text: 'Quiero __.', aid: 'completions' }, expect.any(AbortSignal)))
  const helper = screen.getByRole('group', { name: 'Suggested replies' })
  expect(helper).toHaveTextContent('Quiero agua.')
  expect(helper).toHaveTextContent('Quiero café.')
  expect(helper).not.toHaveTextContent('incorrect meaning')
  expect(within(helper).queryByRole('button', { name: 'Read aloud: __' })).toBeNull()
})

it('leaves failed completion requests available for explicit retry without retrying automatically', async () => {
  vi.mocked(services.read).mockRejectedValueOnce(new Error('Completion unavailable'))
  show()
  fireEvent.click(screen.getByRole('button', { name: '__' }))
  await screen.findByText('Completion unavailable')
  expect(services.read).toHaveBeenCalledOnce()
  fireEvent.click(within(screen.getByRole('group', { name: 'Suggested replies' })).getByRole('button', { name: 'Retry' }))
  await waitFor(() => expect(services.read).toHaveBeenCalledTimes(2))
  expect(services.read).toHaveBeenLastCalledWith({ ...scope, text: 'Quiero __.', aid: 'completions' }, expect.any(AbortSignal), { retry: true })
})


it.each(['我想要___。', 'أريد___اليوم.', 'मुझे___चाहिए।', 'Quiero___hoy.'])('keeps attached template blanks contextual without language branches: %s', async starter => {
  show(false, starter)
  fireEvent.click(screen.getByRole('button', { name: '___' }))
  await waitFor(() => expect(services.read).toHaveBeenCalledExactlyOnceWith({ ...scope, text: starter, aid: 'completions' }, expect.any(AbortSignal)))
})
