// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { ErrorNotice } from './ErrorNotice'
import { ResponseDetails } from './ResponseDetails'

it('dismisses the whole expanded error without triggering its parent or removing the failure', async () => {
  const user = userEvent.setup()
  const parent = vi.fn()
  const failure = new Error('Listening stopped')
  const notice = (error: Error) => <div onClick={parent}><ErrorNotice error={error}>
    {error.message}<ResponseDetails value={error} />
  </ErrorNotice></div>
  const view = render(notice(failure))
  await user.click(screen.getByText('Response details'))
  parent.mockClear()
  screen.getByRole('button', { name: 'Dismiss error' }).focus()
  await user.keyboard('{Enter}')
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.queryByText('Response details')).toBeNull()
  expect(parent).not.toHaveBeenCalled()
  expect(failure.message).toBe('Listening stopped')
  view.rerender(notice(failure))
  expect(screen.queryByRole('alert')).toBeNull()
  view.rerender(notice(new Error('Listening stopped')))
  expect(screen.getByRole('alert')).toBeVisible()
})

it('leads a recognised failure with plain words, folds the owner\'s text and keeps the owner\'s controls in view', async () => {
  const user = userEvent.setup()
  const recorded = 'grouped_request: transport_failed. Provider processing may have occurred; no automatic retry was made.'
  const reload = vi.fn()
  render(<ErrorNotice as="p" error={recorded}>{recorded} <button type="button" onClick={reload}>Reload</button></ErrorNotice>)
  const alert = screen.getByRole('alert')
  expect(alert.tagName).toBe('DIV')
  expect(alert).toHaveAttribute('data-level', 'passing')
  expect(alert).toHaveTextContent("The connection droppedThe answer didn't make it back. Try again.")
  expect(screen.getByText(recorded)).not.toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Reload' }))
  expect(reload).toHaveBeenCalledOnce()
  await user.click(screen.getByText('Technical details'))
  expect(screen.getByText(recorded)).toBeVisible()
})

it('shows an unrecognised failure, and any inline notice, exactly as its owner wrote it', () => {
  const view = render(<ErrorNotice as="p" error="Name is required.">Name is required.</ErrorNotice>)
  expect(screen.getByRole('alert').tagName).toBe('P')
  expect(screen.getByRole('alert')).not.toHaveAttribute('data-level')
  expect(screen.getByText('Name is required.')).toBeVisible()
  view.rerender(<ErrorNotice as="span" error="Transcription is busy. Try again shortly.">Transcription is busy. Try again shortly.</ErrorNotice>)
  expect(screen.getByRole('alert').tagName).toBe('SPAN')
  expect(screen.getByText('Transcription is busy. Try again shortly.')).toBeVisible()
})
