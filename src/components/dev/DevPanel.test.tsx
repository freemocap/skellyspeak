// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { DevPanel } from './DevPanel'
import { RunDetails } from './RunDetails'
import type { Run } from '../../types'
const state = vi.hoisted(() => ({ runs: [] as Run[] }))
vi.mock('./activity', async (original) => {
  const module = await original<typeof import('./activity')>()
  return { ...module, useActivity: () => ({ runs: state.runs, active: [], graphs: [], error: null, loading: false }) }
})
vi.mock('../../lib/log', () => ({ getLogs: () => [], subscribeLogs: () => () => {}, clearLogs: vi.fn() }))
vi.mock('../../lib/tauri', () => ({ getRuns: async () => state.runs, getDiagnostics: async () => [], invoke: async () => ({ evicted: 0 }) }))
vi.mock('../../lib/gate', () => ({ useGate: () => ({ paused: false }), resumePipeline: vi.fn() }))
vi.mock('../graph/AgentGraph', () => ({ AgentGraph: ({ runs }: { runs: Run[] }) => <section aria-label="Live pipeline">{runs.map((item) => <strong key={item.id}>{item.label}</strong>)}</section> }))
vi.mock('../graph/GateControls', () => ({ GateControls: () => <button>Pause</button> }))
function run(id: number, turn: number | null, label: string): Run {
  return { session_id: 'test', app_version: 'test', context: null, length_checks: [], application_status: 'not_reported', id, turn_id: turn, operation: 'reply', actor: { type: 'agent', id: 'chat' }, label, model: 'test-model',
    temperature: null, reasoning: false, max_tokens: null, streamed: true, schema: null, started_at_ms: id,
    first_token_ms: 100, duration_ms: 1000, usage: null, attempts: [{ index: 0, kind: 'ok', duration_ms: 1000, error: null, usage: null, request: { messages: [{ role: 'system', content: 'Recorded prompt', truncated: false }], parameters: {}, route: 'test', blocks: [], truncated: false }, response: 'Recorded response', response_truncated: false }], outcome: 'ok', error: null,
    prompt: 'Recorded prompt', output: 'Recorded response' }
}
beforeEach(() => { state.runs = [run(1, 1, 'Older reply'), run(2, 2, 'Recent reply'), run(3, 2, 'Recent explanation')] })
it('opens the live graph scoped to one exchange, with explanations and debugger controls hidden', async () => {
  render(<DevPanel />)
  expect(await screen.findByRole('region', { name: 'Live pipeline' })).toBeInTheDocument()
  expect(screen.getByText('Recent reply')).toBeInTheDocument()
  expect(screen.getByText('Recent explanation')).toBeInTheDocument()
  expect(screen.queryByText('Older reply')).not.toBeInTheDocument()
  expect(screen.queryByText('Pause')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'How it works' })).toHaveAttribute('aria-expanded', 'false')
  fireEvent.change(screen.getByLabelText('Inspect'), { target: { value: 'turn:1' } })
  expect(screen.getByText('Older reply')).toBeInTheDocument()
  expect(screen.queryByText('Recent reply')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Debug ▾' }))
  expect(screen.getByText('Pause')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Live pipeline' })).toBeInTheDocument()
})
it('keeps standalone calls separate', async () => {
  state.runs = [run(1, null, 'Word lookup'), run(2, null, 'Coach answer')]
  render(<DevPanel />)
  await screen.findByRole('region', { name: 'Live pipeline' })
  expect(screen.queryByText('Word lookup', { selector: 'strong' })).not.toBeInTheDocument()
  expect(screen.getByText('Coach answer', { selector: 'strong' })).toBeInTheDocument()
})
it('shows a response preview but keeps actual prompts behind deliberate disclosure', () => {
  render(<RunDetails run={run(1, 1, 'Reply')} />)
  expect(screen.getByText('Recorded response', { selector: '.run-preview pre' })).toBeVisible()
  const prompt = screen.getByText('Actual prompt sent').closest('details')!
  expect(prompt).not.toHaveAttribute('open')
  fireEvent.click(within(prompt).getByText('Actual prompt sent'))
  expect(within(prompt).getByText('Recorded prompt')).toBeVisible()
})

it('separates model success from difficulty violations and application state', () => {
  const recorded = run(1, 1, 'Reply')
  recorded.application_status = 'conversation_saved'
  recorded.length_checks = [{ status: 'violation', sentences: 5, words: 27, violations: ['5 sentences exceeds 2'], method: 'Diagnostic only, not a CEFR assessment.' }]
  render(<RunDetails run={recorded} />)
  expect(screen.getByText(/Model call completed/)).toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('5 sentences exceeds 2')
  expect(screen.getByText('Application: conversation saved')).toBeInTheDocument()
})

it('opens a searchable full-height request reader and compares recorded blocks', async () => {
  const current = run(2, 2, 'Reply')
  const previous = run(1, 1, 'Reply')
  current.attempts[0].request!.blocks = [{ id: 'difficulty', source: 'selected level', content: 'PRE-A1: tiny sentences' }]
  previous.attempts[0].request!.blocks = [{ id: 'difficulty', source: 'selected level', content: 'A2: short sentences' }]
  state.runs = [previous, current]
  render(<RunDetails run={current} />)
  fireEvent.click(screen.getByRole('button', { name: 'Read / compare requests' }))
  const dialog = await screen.findByRole('dialog', { name: 'Request audit' })
  await within(dialog).findByRole('option', { name: /#1/ })
  fireEvent.change(within(dialog).getByLabelText('Compare'), { target: { value: '1' } })
  expect(within(dialog).getByText('A2: short sentences')).toBeInTheDocument()
  fireEvent.change(within(dialog).getByLabelText('Search recorded messages'), { target: { value: 'missing phrase' } })
  expect(within(dialog).queryByText('Recorded prompt')).not.toBeInTheDocument()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
  expect(screen.queryByRole('dialog', { name: 'Request audit' })).not.toBeInTheDocument()
})
