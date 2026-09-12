// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ComposerHelp } from './ComposerHelp'
import { ReadingProvider } from '../TargetText'
import type { SuggestedReply } from '../../contracts'

const backend = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('../../lib/tauri', () => backend)
beforeEach(() => { backend.invoke.mockReset() })
const replies: SuggestedReply[] = [
  { text: '我很好。', segments: [{ start: 0, end: 1, kind: 'gloss', gloss: 'I', romanization: 'wǒ' }, { start: 1, end: 2, kind: 'gloss', gloss: 'very' }, { start: 2, end: 3, kind: 'gloss', gloss: 'good' }] },
  { text: '还不错。', segments: [{ start: 0, end: 3, kind: 'gloss', gloss: 'not bad' }] },
]
const base = { replies, pending: false, busy: false, errors: [] }

it('shows every saved reply and inserts only from its arrow', () => {
  const onUse = vi.fn()
  const view = render(<ReadingProvider settings={null}><ComposerHelp {...base} onUse={onUse} /></ReadingProvider>)
  expect(view.container.querySelector('section')?.firstElementChild).toHaveAttribute('aria-label', 'Suggested replies')
  expect(view.container.querySelectorAll('.help-reply')).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'Insert reply: 我很好。' }))
  expect(onUse).toHaveBeenCalledWith('我很好。', 'suggestion')
  fireEvent.click(view.container.querySelector('.help-reply')!)
  expect(onUse).toHaveBeenCalledOnce()
  expect(backend.invoke).not.toHaveBeenCalled()
})

it('reveals the saved gloss of a tapped word without inserting or requesting analysis', () => {
  const onUse = vi.fn()
  render(<ReadingProvider settings={null}><ComposerHelp {...base} onUse={onUse} /></ReadingProvider>)
  expect(screen.queryByText('very')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '很' }))
  expect(screen.getByText('very')).toBeVisible()
  expect(onUse).not.toHaveBeenCalled()
  expect(backend.invoke).not.toHaveBeenCalled()
})

it('distinguishes loading reply ideas from a failed suggestions job', () => {
  const props = { replies: [], busy: false, onUse: vi.fn() }
  const { rerender } = render(<ComposerHelp {...props} pending errors={[]} />)
  expect(screen.getByRole('status')).toHaveTextContent('Finding reply ideas…')
  rerender(<ComposerHelp {...props} pending={false} errors={['Coach feedback rejected: suggestion_token_not_in_reply.']} />)
  expect(screen.getByRole('alert')).toHaveTextContent('Reply ideas')
  expect(screen.getByText('Coach feedback rejected: suggestion_token_not_in_reply.')).not.toBeVisible()
  fireEvent.click(screen.getByText('⚠ Reply ideas'))
  expect(screen.getByText('Coach feedback rejected: suggestion_token_not_in_reply.')).toBeVisible()
})

it('disables only insertion during a conversation request', () => {
  render(<ReadingProvider settings={null}><ComposerHelp {...base} busy onUse={vi.fn()} /></ReadingProvider>)
  expect(screen.getByRole('button', { name: 'Insert reply: 我很好。' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '很' })).toBeEnabled()
})

it('renders nothing when there are no reply ideas, pending work or failures', () => {
  const onUse = vi.fn()
  const { container } = render(<ComposerHelp replies={[]} pending={false} busy={false} errors={[]} onUse={onUse} />)
  expect(container).toBeEmptyDOMElement()
  expect(onUse).not.toHaveBeenCalled()
})
