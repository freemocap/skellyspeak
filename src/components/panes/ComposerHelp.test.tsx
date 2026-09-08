// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ComposerHelp } from './ComposerHelp'
import type { CoachHelp } from '../../types'

const help: CoachHelp = {
  explanation: 'They are asking how you are.',
  partner: { text: '你好吗？', translation: 'How are you?', romanization: 'Nǐ hǎo ma?', pronunciation: 'nee how mah' },
  replies: [{ text: '我很好。', translation: 'I am well.', romanization: 'Wǒ hěn hǎo.', pronunciation: 'waw hun how' }],
}

it('shows preloaded meaning and romanization immediately and inserts only the chosen target text', () => {
  const onUse = vi.fn()
  render(<ComposerHelp help={help} pending busy={false} errors={[]} onUse={onUse} onRefresh={vi.fn()} />)
  expect(screen.getByText('How are you?')).toBeVisible()
  expect(screen.getByText('They are asking how you are.')).toBeVisible()
  expect(screen.getByText('Nǐ hǎo ma?')).toBeVisible()
  expect(screen.getByText('Wǒ hěn hǎo.')).toBeVisible()
  expect(screen.getByText('waw hun how')).not.toBeVisible()
  fireEvent.click(screen.getAllByText('Pronunciation')[1])
  expect(screen.getByText('waw hun how')).toBeVisible()
  expect(onUse).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '我很好。' }))
  expect(onUse).toHaveBeenCalledWith('我很好。', 'suggestion')
})

it('distinguishes loading advice from a failed analysis without showing stale suggestions', () => {
  const props = { help: null, busy: false, onUse: vi.fn(), onRefresh: vi.fn() }
  const { rerender } = render(<ComposerHelp {...props} pending errors={[]} />)
  expect(screen.getByRole('status')).toHaveTextContent('Loading…')
  rerender(<ComposerHelp {...props} pending={false} errors={['Suggestions failed: provider unavailable']} />)
  expect(screen.getByRole('alert')).toHaveTextContent('provider unavailable')
  expect(screen.getByRole('button', { name: 'Regenerate advice' })).toBeDisabled()
})

it('keeps existing advice visible during refresh and prevents duplicate requests', async () => {
  let finish: () => void = () => { throw new Error('Refresh not started') }
  const onRefresh = vi.fn(() => new Promise<void>(resolve => { finish = resolve }))
  render(<ComposerHelp help={help} pending={false} busy={false} errors={[]} onUse={vi.fn()} onRefresh={onRefresh} />)
  const button = screen.getByRole('button', { name: 'Regenerate advice' })
  fireEvent.click(button)
  fireEvent.click(button)
  expect(onRefresh).toHaveBeenCalledTimes(1)
  expect(button).toBeDisabled()
  expect(screen.getByText('How are you?')).toBeVisible()
  await act(async () => { finish() })
  expect(button).toBeEnabled()
})
