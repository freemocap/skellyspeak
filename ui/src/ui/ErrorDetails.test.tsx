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

it('dismisses expanded diagnostics without requiring the user to close them first', async () => {
  const user = userEvent.setup()
  render(<ErrorDetails label="Coach" errorKey="failure">Full diagnostic</ErrorDetails>)
  await user.click(screen.getByText('⚠ Coach'))
  expect(screen.getByText('Full diagnostic')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Dismiss coach error' }))
  expect(screen.queryByText('Full diagnostic')).toBeNull()
})
