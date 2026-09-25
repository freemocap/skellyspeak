// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { FeedbackContextForm } from './FeedbackContextForm'
it('submits a trimmed note once and keeps it available after failure', async () => {
  let reject!: (reason: Error) => void
  const submit = vi.fn(() => new Promise<void>((_, fail) => { reject = fail }))
  render(<FeedbackContextForm reviewing={false} onSubmit={submit} />)
  expect(screen.getByRole('button', { name: 'Reassess with context' })).toBeDisabled()
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '  I meant yesterday.  ' } })
  fireEvent.submit(screen.getByRole('button', { name: 'Reassess with context' }).closest('form')!)
  fireEvent.submit(screen.getByRole('button', { name: 'Reassess with context' }).closest('form')!)
  expect(submit).toHaveBeenCalledExactlyOnceWith('I meant yesterday.')
  await act(async () => reject(new Error('Assessment unavailable')))
  expect(screen.getByRole('alert')).toHaveTextContent('Assessment unavailable')
  expect(screen.getByRole('textbox')).toHaveValue('  I meant yesterday.  ')
  expect(screen.getByRole('button', { name: 'Reassess with context' })).toBeEnabled()
})
it('shows the saved note and blocks duplicate requests during assessment', () => {
  render(<FeedbackContextForm saved="I meant yesterday." reviewing onSubmit={vi.fn()} />)
  expect(screen.getByRole('textbox')).toHaveValue('I meant yesterday.')
  expect(screen.getByRole('button', { name: 'Reassess with context' })).toBeDisabled()
  expect(screen.getByRole('status')).toBeVisible()
})

it('keeps context entry visible and expands it on focus', () => {
  render(<FeedbackContextForm reviewing={false} onSubmit={vi.fn()} />)
  const input = screen.getByRole('textbox', { name: 'Add context' })
  expect(input).toBeVisible()
  expect(input).toHaveAttribute('rows', '1')
  fireEvent.focus(input)
  expect(input).toHaveAttribute('rows', '3')
})
