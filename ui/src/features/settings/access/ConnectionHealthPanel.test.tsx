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

it.each([
  ['accepted', 200, 'Accepted'],
  ['rejected', 401, 'Rejected · HTTP 401'],
  ['unreachable', null, 'Unreachable'],
])('shows ElevenLabs %s and omits Groq when the server does not use it', (state, status, label) => {
  render(<ConnectionHealthPanel bearerAuth disabled={false} onCheck={vi.fn()} health={{
    revision: 1, status: state === 'accepted' ? 'connected' : 'disconnected', checkedAt: 1, error: null,
    providers: [{provider:'OPENROUTER',state:'accepted',status:200,durationMs:20}, {provider:'ELEVENLABS',state,status,durationMs:10}],
  }} />)
  const row = screen.getByText('ElevenLabs').closest('li')!
  expect(within(row).getByText(label)).toBeInTheDocument()
  expect(screen.queryByText('Groq')).toBeNull()
})

it('shows all three providers when the server checks all three', () => {
  render(<ConnectionHealthPanel bearerAuth disabled={false} onCheck={vi.fn()} health={{
    revision: 1, status: 'connected', checkedAt: 1, error: null,
    providers: ['OPENROUTER', 'GROQ', 'ELEVENLABS'].map(provider => ({provider,state:'accepted',status:200,durationMs:10})),
  }} />)
  expect(screen.getByText('OpenRouter')).toBeInTheDocument()
  expect(screen.getByText('Groq')).toBeInTheDocument()
  expect(screen.getByText('ElevenLabs')).toBeInTheDocument()
})
