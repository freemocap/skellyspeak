// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ReplyHelp } from './ReplyHelp'
import { ReadingProvider } from '../../../components/reading/TargetText'
import type { ReplyExplanation, SuggestedReply } from '../../../generated/contracts'

const backend = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('../../../platform/ipc/tauri', () => backend)
beforeEach(() => { backend.invoke.mockReset() })

const replies: SuggestedReply[] = [
  { text: '我很好。', segments: [{ start: 0, end: 1, kind: 'gloss', gloss: 'I', romanization: 'wǒ' }, { start: 1, end: 2, kind: 'gloss', gloss: 'very' }, { start: 2, end: 3, kind: 'gloss', gloss: 'good' }] },
  { text: '还不错。', segments: [{ start: 0, end: 3, kind: 'gloss', gloss: 'not bad' }] },
]
const grammar: ReplyExplanation[] = [
  { quote: '你好吗？', title: 'Yes-no questions with 吗', body: 'Add 吗 to a statement to make it a question.', example: '你累吗？', contrast: 'English inverts the verb; Mandarin keeps the word order.' },
]
const base = { brief: 'She asked how you are. Answer, then ask her back.', busy: false, errors: [] as string[], onUse: () => {} }

function show(props: Partial<Parameters<typeof ReplyHelp>[0]> = {}) {
  return render(<ReadingProvider settings={null}><ReplyHelp {...base} {...props} /></ReadingProvider>)
}

it('opens to the brief alone and computes neither request', () => {
  const onExplainGrammar = vi.fn(), onSuggestReply = vi.fn()
  show({ onExplainGrammar, onSuggestReply })
  expect(screen.getByText(/She asked how you are/)).toBeVisible()
  expect(screen.getByRole('button', { name: /Explain grammar/ })).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByRole('button', { name: /Suggest a reply/ })).toHaveAttribute('aria-expanded', 'false')
  expect(onExplainGrammar).not.toHaveBeenCalled()
  expect(onSuggestReply).not.toHaveBeenCalled()
  expect(backend.invoke).not.toHaveBeenCalled()
})

it('asks for reply ideas once and keeps them on reopen', async () => {
  const onSuggestReply = vi.fn().mockResolvedValue(undefined)
  const view = show({ onSuggestReply })
  fireEvent.click(screen.getByRole('button', { name: /Suggest a reply/ }))
  expect(onSuggestReply).toHaveBeenCalledOnce()
  // The answer lands in the snapshot, so reopening must not ask again.
  view.rerender(<ReadingProvider settings={null}><ReplyHelp {...base} onSuggestReply={onSuggestReply} replies={replies} /></ReadingProvider>)
  expect(screen.getAllByRole('listitem')).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: /Suggest a reply/ }))
  fireEvent.click(screen.getByRole('button', { name: /Suggest a reply/ }))
  expect(onSuggestReply).toHaveBeenCalledOnce()
})

it('discloses grammar without touching the reply ideas', () => {
  show({ grammar, replies })
  expect(screen.queryByText('Yes-no questions with 吗')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Explain grammar/ }))
  expect(screen.getByText('Yes-no questions with 吗')).toBeVisible()
  expect(screen.getByText(/Add 吗 to a statement/)).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Insert reply: 我很好。' })).toBeNull()
})

it('inserts only from the arrow and leaves words tappable', () => {
  const onUse = vi.fn()
  const view = show({ replies, onUse })
  fireEvent.click(screen.getByRole('button', { name: /Suggest a reply/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Insert reply: 我很好。' }))
  expect(onUse).toHaveBeenCalledExactlyOnceWith('我很好。', 'suggestion')
  fireEvent.click(view.container.querySelector('.help-reply')!)
  expect(onUse).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: '很' }))
  expect(screen.getByText('very')).toBeVisible()
  expect(onUse).toHaveBeenCalledOnce()
})

it('inserts a sentence starter as a scaffold', () => {
  const onUse = vi.fn()
  show({ starters: ['我和___。'], onUse })
  fireEvent.click(screen.getByRole('button', { name: /Suggest a reply/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Insert starter: 我和___。' }))
  expect(onUse).toHaveBeenCalledExactlyOnceWith('我和___。', 'scaffold')
})

it('disables insertion during a send but not word help', () => {
  show({ replies, busy: true })
  fireEvent.click(screen.getByRole('button', { name: /Suggest a reply/ }))
  expect(screen.getByRole('button', { name: 'Insert reply: 我很好。' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '很' })).toBeEnabled()
})

it('folds to one button that restores the brief', () => {
  show({ grammar })
  fireEvent.click(screen.getByRole('button', { name: 'Hide reply help' }))
  expect(screen.queryByText(/She asked how you are/)).toBeNull()
  const reopen = screen.getByRole('button', { name: 'Help with this reply' })
  expect(reopen).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(reopen)
  expect(screen.getByText(/She asked how you are/)).toBeVisible()
})

it('stays folded while no brief has arrived', () => {
  render(<ReplyHelp busy={false} errors={[]} onUse={() => {}} onSuggestReply={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Help with this reply' })).toHaveAttribute('aria-expanded', 'false')
})

it('reports a failed suggestions job without hiding the brief', () => {
  show({ errors: ['Coach feedback rejected: suggestion_token_not_in_reply.'] })
  expect(screen.getByText(/She asked how you are/)).toBeVisible()
  expect(screen.getByRole('alert')).toHaveTextContent('Reply help')
  expect(screen.getByText('Coach feedback rejected: suggestion_token_not_in_reply.')).not.toBeVisible()
  fireEvent.click(screen.getByText('⚠ Reply help'))
  expect(screen.getByText('Coach feedback rejected: suggestion_token_not_in_reply.')).toBeVisible()
})

it('renders nothing without a brief, a request or a failure', () => {
  const { container } = render(<ReplyHelp busy={false} errors={[]} onUse={() => {}} />)
  expect(container).toBeEmptyDOMElement()
})
