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
