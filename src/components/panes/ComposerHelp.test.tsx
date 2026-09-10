// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ComposerHelp } from './ComposerHelp'
import { ReadingProvider } from '../TargetText'
import { ReadingPreferencesContext } from '../ReadingPreferences'
import type { CoachHelp } from '../../types'

const backend = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('../../lib/tauri', () => backend)
beforeEach(() => { HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", "") }; HTMLDialogElement.prototype.close = function () { this.removeAttribute("open") }; backend.invoke.mockReset(); backend.invoke.mockResolvedValue({ gloss: 'I', lemma: '我', pos: '', form: '', role: '', usage: '' }) })
const off = { autoTranslate: false, alwaysPronunciation: false, alwaysRomanize: false }
const on = { autoTranslate: true, alwaysPronunciation: true, alwaysRomanize: true }
const help: CoachHelp = {
  explanation: 'They are asking how you are.',
  partner: { text: '你好吗？', translation: 'How are you?', romanization: 'Nǐ hǎo ma?', pronunciation: 'nee how mah' },
  replies: [{ text: '我很好。', translation: 'I am well.', romanization: 'Wǒ hěn hǎo.', pronunciation: 'waw hun how' }],
}
const base = { help, pending: false, busy: false, errors: [] }

it('inserts only from the arrow and keeps word inspection independent', async () => {
  const onUse = vi.fn()
  const view = render(<ReadingProvider settings={null}><ComposerHelp {...base} onUse={onUse} /></ReadingProvider>)
  expect(view.container.querySelector('section')?.firstElementChild).toHaveAttribute('aria-label', 'Suggested replies')
  expect(view.container.querySelector('.help-reply')).not.toHaveAttribute('role', 'button')
  expect(screen.queryByText('Reading help')).toBeNull()
  expect(screen.queryByText('Use')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Insert reply: 我很好。' }))
  expect(onUse).toHaveBeenCalledWith('我很好。', 'suggestion')
  expect(backend.invoke).not.toHaveBeenCalled()
  fireEvent.click(await screen.findByRole('button', { name: '我' }))
  expect(await screen.findByText('I')).toBeVisible()
  expect(onUse).toHaveBeenCalledOnce()
  fireEvent.click(view.container.querySelector('.help-reply')!)
  expect(onUse).toHaveBeenCalledOnce()
  expect(backend.invoke).toHaveBeenCalledOnce()
})

it('updates all reading aids from the shared settings without affecting the explanation', async () => {
  const props = { ...base, onUse: vi.fn() }
  const view = render(<ReadingProvider settings={null}><ReadingPreferencesContext value={off}><ComposerHelp {...props} /></ReadingPreferencesContext></ReadingProvider>)
  await screen.findByRole('button', { name: '我' })
  fireEvent.click(screen.getByText('Understand the exchange'))
  expect(screen.getByText('They are asking how you are.')).toBeVisible()
  for (const text of ['I am well.', 'How are you?', 'Wǒ', 'waw']) expect(screen.queryByText(text)).toBeNull()
  view.rerender(<ReadingProvider settings={null}><ReadingPreferencesContext value={on}><ComposerHelp {...props} /></ReadingPreferencesContext></ReadingProvider>)
  for (const text of ['I am well.', 'How are you?']) expect(screen.getByText(text)).toBeVisible()
  for (const text of ['Wǒ', 'waw']) expect(screen.queryByText(text)).toBeNull()
  expect(view.container).not.toHaveTextContent('你好吗？')
  view.rerender(<ReadingProvider settings={null}><ReadingPreferencesContext value={off}><ComposerHelp {...props} /></ReadingPreferencesContext></ReadingProvider>)
  for (const text of ['I am well.', 'How are you?', 'Wǒ', 'waw']) expect(screen.queryByText(text)).toBeNull()
  expect(backend.invoke).not.toHaveBeenCalled()
})

it('distinguishes loading advice from a failed analysis', () => {
  const props = { help: null, busy: false, onUse: vi.fn() }
  const { rerender } = render(<ComposerHelp {...props} pending errors={[]} />)
  expect(screen.getByRole('status')).toHaveTextContent('Finding reply ideas…')
  rerender(<ComposerHelp {...props} pending={false} errors={['Suggestions failed: provider unavailable']} />)
  expect(screen.getByRole('alert')).toHaveTextContent('provider unavailable')
})

it('disables only insertion during a conversation request', async () => {
  render(<ReadingProvider settings={null}><ComposerHelp {...base} busy onUse={vi.fn()} /></ReadingProvider>)
  expect(screen.getByRole('button', { name: 'Insert reply: 我很好。' })).toBeDisabled()
  expect(await screen.findByRole('button', { name: '我' })).toBeEnabled()
})
