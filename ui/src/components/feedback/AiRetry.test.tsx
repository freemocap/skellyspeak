// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { AiRetryContext } from './AiRetry'
import { ErrorDetails } from './ErrorDetails'
import { ErrorNotice } from './ErrorNotice'

it('exposes retry without expanding technical details and prevents double submission', async () => {
  let finish!: () => void
  const retry = vi.fn(() => new Promise<void>(resolve => {finish = resolve}))
  render(<AiRetryContext value={retry}><ErrorDetails label="Analysis" errorKey="failed">Failed</ErrorDetails></AiRetryContext>)
  const button = screen.getByRole('button', {name:'Retry'})
  expect(button).toBeVisible()
  fireEvent.click(button); fireEvent.click(button)
  await waitFor(() => expect(retry).toHaveBeenCalledOnce())
  expect(button).toBeDisabled()
  finish()
  await waitFor(() => expect(button).toBeEnabled())
})
it('explicit retry overrides the exchange operation and errors remain visible', async () => {
  const inherited = vi.fn(), own = vi.fn().mockRejectedValue(new Error('Still unavailable'))
  render(<AiRetryContext value={inherited}><ErrorNotice error="Speech failed" onRetry={own}>Speech failed</ErrorNotice></AiRetryContext>)
  fireEvent.click(screen.getByRole('button', {name:'Retry'}))
  await screen.findByText('Still unavailable')
  expect(own).toHaveBeenCalledOnce()
  expect(inherited).not.toHaveBeenCalled()
})
