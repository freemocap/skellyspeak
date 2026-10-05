// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { ErrorDetails } from './ErrorDetails'

it('dismisses a collapsed notice by keyboard and keeps it dismissed across parent rerenders', async () => {
  const user = userEvent.setup()
  const view = render(<ErrorDetails label="Request failed" errorKey="first"><p>First failure</p></ErrorDetails>)
  expect(screen.getByText('First failure')).not.toBeVisible()
  screen.getByRole('button', { name: 'Dismiss request failed error' }).focus()
  await user.keyboard('{Enter}')
  expect(screen.queryByRole('alert')).toBeNull()
  view.rerender(<ErrorDetails label="Request failed" errorKey="first"><p>First failure</p></ErrorDetails>)
  expect(screen.queryByRole('alert')).toBeNull()
  view.rerender(<ErrorDetails label="Request failed" errorKey="second"><p>Second failure</p></ErrorDetails>)
  expect(screen.getByRole('alert')).toBeVisible()
})

it('tells its owner when dismissed, so what failed can be dropped with it', async () => {
  const user = userEvent.setup()
  const dropped: string[] = []
  render(<ErrorDetails label="Request failed" errorKey="send" onDismiss={() => dropped.push('send')}>Admission refused</ErrorDetails>)
  await user.click(screen.getByRole('button', { name: 'Dismiss request failed error' }))
  expect(dropped).toEqual(['send'])
})

it('folds machine output behind a plain summary and dismisses it while expanded', async () => {
  const user = userEvent.setup()
  render(<ErrorDetails label="Coach" errorKey="failure">coach_reply: schema_mismatch at $.items[0]</ErrorDetails>)
  expect(screen.getByRole('alert')).toHaveTextContent('CoachSomething went wrongTry again, and open the details if it keeps happening.')
  expect(screen.getByText('coach_reply: schema_mismatch at $.items[0]')).not.toBeVisible()
  await user.click(screen.getByText('Technical details'))
  expect(screen.getByText('coach_reply: schema_mismatch at $.items[0]')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Dismiss coach error' }))
  expect(screen.queryByText('coach_reply: schema_mismatch at $.items[0]')).toBeNull()
})

it('keeps a readable explanation in view, with nothing left to fold', () => {
  render(<ErrorDetails label="Add to Practice" errorKey="length">Enter between 1 and 512 characters to practise.</ErrorDetails>)
  expect(screen.getByText('Enter between 1 and 512 characters to practise.')).toBeVisible()
  expect(screen.queryByText('Technical details')).toBeNull()
})

it('says when daily credits return and marks where adding credits will be', () => {
  const recorded = 'Your remaining daily allowance cannot cover this request. Wait for pending requests to finish or for the 00:00 UTC reset.'
  render(<ErrorDetails label="Request failed" errorKey="credits" explanation={recorded} onRetry={null}><p>Receipt</p></ErrorDetails>)
  expect(screen.getByRole('alert')).toHaveTextContent(/You're out of credits for today.*You get new credits at \d{1,2}:\d{2}/)
  expect(screen.getByRole('alert').closest('details')).toHaveAttribute('data-level', 'needs-you')
  expect(screen.getByText(recorded)).not.toBeVisible()
  expect(screen.getByRole('button', { name: 'Add credits · Coming soon' })).toBeDisabled()
})

it('offers no credits control for any other failure', () => {
  render(<ErrorDetails label="Speech" errorKey="busy" onRetry={null}>Transcription is busy. Try again shortly.</ErrorDetails>)
  expect(screen.getByRole('alert')).toHaveTextContent('SpeechThe AI service is busyWait a few seconds, then try again.')
  expect(screen.getByRole('alert').closest('details')).toHaveAttribute('data-level', 'passing')
  expect(screen.queryByRole('button', { name: /Add credits/ })).toBeNull()
})
