// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ConnectionHealthPanel } from './ConnectionHealthPanel'

it('shows a separate red Groq failure beside accepted server and chat checks', () => {
  const check = vi.fn()
  render(<ConnectionHealthPanel bearerAuth disabled={false} onCheck={check} health={{
    revision: 1, status: 'disconnected', checkedAt: 1, error: null,
    providers: [{provider:'OPENROUTER',state:'accepted',status:200,durationMs:20}, {provider:'GROQ',state:'rejected',status:403,durationMs:10}],
  }} />)
  const row = screen.getByText('Groq').closest('li')!
  expect(row).toHaveAttribute('data-state', 'rejected')
  expect(within(row).getByText('Rejected · HTTP 403')).toBeInTheDocument()
  expect(screen.getAllByText('Accepted')).toHaveLength(3)
  fireEvent.click(screen.getByRole('button', {name:'Check connection'}))
  expect(check).toHaveBeenCalledOnce()
})
