// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useNavigationStore } from '../../state/navigation/navigation'
import { AiView } from './AiView'

const api = vi.hoisted(() => ({ readWorkspace: vi.fn(), watchConversation: vi.fn(), listTurnHistory: vi.fn(), readAttemptDetail: vi.fn() }))
const windowApi = vi.hoisted(() => ({ getAiViewSelection: vi.fn(), setAiViewSelection: vi.fn(), getAiGraphDefinitions: vi.fn() }))
vi.mock('../../platform/ipc/workspace', () => ({ ...api, selectedConversation: (workspace: { selected: string | null }) => workspace.selected ? { id: workspace.selected } : null, nativeError: String }))
vi.mock('../../platform/ipc/window', () => windowApi)
vi.mock('../../platform/ipc/attempt-streams', () => ({ onAttemptStream: async () => () => {}, readAttemptStreams: async () => ({ generation: 1, entries: [] }) }))
vi.mock('./GenerationActivity', () => ({ GenerationActivity: () => <div>Generation receipts</div> }))
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ nodes, edges }: { nodes: { id: string; data: { label: string; phase: string | null; onSelect: () => void } }[]; edges: unknown[] }) => <div>
    <pre data-testid="graph">{JSON.stringify({ nodes: nodes.map(node => ({ id: node.id, label: node.data.label, phase: node.data.phase })), edges })}</pre>
    {nodes.map(node => <button key={node.id} type="button" data-testid={`node-${node.id}`} onClick={node.data.onSelect}>{node.data.label}</button>)}
  </div>,
  Background: () => null, Controls: () => null, Handle: () => null, Position: { Left: 'left', Right: 'right' }, useReactFlow: () => ({ fitView: async () => true }),
}))
beforeEach(() => {
  vi.resetAllMocks()
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
  useNavigationStore.setState({ aiInspection: null })
  windowApi.getAiViewSelection.mockResolvedValue(null)
  windowApi.setAiViewSelection.mockResolvedValue(undefined)
  api.readAttemptDetail.mockResolvedValue({ requestMessages: null, responseText: null, previewText: null })
})

function attempt(operationId: string, overrides: Record<string, unknown> = {}) {
  return { id: `${operationId}-attempt`, operationId, state: 'succeeded', requestedModel: 'model', actualModel: null, providerId: null, startedAt: '2026-09-18T10:00:00.000Z', finishedAt: '2026-09-18T10:00:02.000Z', inputTokens: 10, outputTokens: 4, error: null, unpublishedText: null, ...overrides }
}
function turn(id: string, operations: { id: string; kind: string; state: string; dependencies: string[] }[], attempts: unknown[] = []) {
  return { id, state: 'assisting', paused: false, hold: null, operations: operations.map(op => ({ role: 'standard', contractVersion: 1, sourceMessageId: null, ...op })), attempts }
}
function snapshot(conversationId: string, revision: number, turns: unknown[]) {
  return { conversationId, revision, transcriptionAttempts: [], turns }
}

it('renders actual dependency IDs and watches updates without dispatching AI', async () => {
  api.readWorkspace.mockResolvedValue({ selected: 'chat' })
  api.watchConversation.mockResolvedValueOnce(snapshot('chat', 2, [turn('turn', [
    { id: 'reply', kind: 'persona_reply', state: 'succeeded', dependencies: [] },
    { id: 'gloss', kind: 'persona_word_gloss', state: 'running', dependencies: ['reply'] },
  ], [attempt('reply'), attempt('gloss', { state: 'running', finishedAt: null })])])).mockImplementation(() => new Promise(() => {}))
  render(<AiView mode="docked" actions={null} />)
  await waitFor(() => expect(screen.getByTestId('graph')).toHaveTextContent('"label":"persona word gloss","phase":"running"'))
  expect(screen.getByTestId('graph')).toHaveTextContent('"source":"reply","target":"gloss"')
  expect(api.watchConversation).toHaveBeenLastCalledWith('chat', 2)
})

it('maps every recorded state, including snapshot-derived held, and inspects the selected operation', async () => {
  api.readWorkspace.mockResolvedValue({ selected: 'chat' })
  const states = ['waiting_dependencies', 'ready', 'held', 'running', 'succeeded', 'failed', 'unknown', 'cancelled', 'invalidated']
  api.watchConversation.mockResolvedValueOnce(snapshot('chat', 1, [turn('turn', states.map(state => ({ id: state, kind: `kind_${state}`, state, dependencies: [] })), [attempt('failed', { state: 'failed', error: 'Provider refused' })])]))
    .mockImplementation(() => new Promise(() => {}))
  render(<AiView mode="docked" actions={null} />)
  await waitFor(() => expect(screen.getByTestId('graph')).toHaveTextContent('kind held'))
  const graph = JSON.parse(screen.getByTestId('graph').textContent!) as { nodes: { id: string; phase: string }[] }
  expect(Object.fromEntries(graph.nodes.map(node => [node.id, node.phase]))).toEqual({
    waiting_dependencies: 'waiting', ready: 'waiting', held: 'held', running: 'running', succeeded: 'succeeded',
    failed: 'failed', unknown: 'unknown', cancelled: 'ended', invalidated: 'ended',
  })
  fireEvent.click(screen.getByTestId('node-failed'))
  const inspector = screen.getByRole('complementary', { name: 'Selected operation' })
  expect(within(inspector).getByRole('heading', { level: 3 })).toHaveTextContent('kind failed')
  expect(within(inspector).getByRole('alert')).toHaveTextContent('Provider refused')
  await waitFor(() => expect(windowApi.setAiViewSelection).toHaveBeenLastCalledWith({ conversationId: 'chat', turnId: null, operationKind: 'kind_failed' }))
})

it('pins an older exchange from the operation history and pages turns by turn', async () => {
  api.readWorkspace.mockResolvedValue({ selected: 'chat' })
  const recent = Array.from({ length: 50 }, (_, index) => turn(`turn-${50 - index}`, [{ id: `reply-${50 - index}`, kind: 'persona_reply', state: 'succeeded', dependencies: [] }], [attempt(`reply-${50 - index}`)]))
  api.watchConversation.mockResolvedValueOnce(snapshot('chat', 3, recent)).mockImplementation(() => new Promise(() => {}))
  api.listTurnHistory.mockResolvedValue({ turns: [turn('turn-0', [{ id: 'reply-0', kind: 'persona_reply', state: 'failed', dependencies: [] }], [attempt('reply-0', { state: 'failed', error: 'Old failure' })])], hasOlder: false })
  render(<AiView mode="docked" actions={null} />)
  await waitFor(() => expect(screen.getByTestId('graph')).toHaveTextContent('reply-50'))
  fireEvent.click(await screen.findByRole('button', { name: 'Older' }))
  await waitFor(() => expect(api.listTurnHistory).toHaveBeenCalledWith('chat', 'turn-1', 40))
  const history = await screen.findAllByRole('button', { name: /failed/ })
  fireEvent.click(history.at(-1)!)
  await waitFor(() => expect(screen.getByTestId('graph')).toHaveTextContent('reply-0'))
  expect(screen.getByRole('button', { name: 'Follow live' })).toHaveAttribute('aria-pressed', 'false')
  expect(screen.queryByRole('button', { name: 'Older' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Follow live' }))
  await waitFor(() => expect(screen.getByTestId('graph')).toHaveTextContent('reply-50'))
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (failure: Error) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
function single(conversationId: string, revision: number, operation: string) {
  return snapshot(conversationId, revision, [turn(`${conversationId}-turn`, [{ id: operation, kind: operation, state: 'running', dependencies: [] }])])
}

it('follows native selection while mounted and rejects the abandoned watch response', async () => {
  let selected = 'first'
  api.readWorkspace.mockImplementation(async () => ({ selected }))
  const oldWait = deferred<unknown>()
  const nextWait = deferred<unknown>()
  api.watchConversation.mockImplementation((id: string, revision: number) => {
    if (id === 'first' && revision === -1) return Promise.resolve(single('first', 1, 'first_operation'))
    if (id === 'first') return oldWait.promise
    if (id === 'second' && revision === -1) return nextWait.promise
    return new Promise(() => {})
  })
  render(<AiView mode="docked" actions={null} />)
  await waitFor(() => expect(screen.getByTestId('graph')).toHaveTextContent('first operation'))
  selected = 'second'
  await act(async () => { oldWait.resolve(single('first', 2, 'obsolete_operation')) })
  await waitFor(() => expect(api.watchConversation).toHaveBeenLastCalledWith('second', -1))
  expect(screen.queryByTestId('graph')).toBeNull()
  await act(async () => { nextWait.resolve(single('second', 3, 'second_operation')) })
  await waitFor(() => expect(screen.getByTestId('graph')).toHaveTextContent('second operation'))
  expect(api.watchConversation).toHaveBeenLastCalledWith('second', 3)
})

it('starts watching when a conversation is selected after an empty workspace', async () => {
  vi.useFakeTimers()
  try {
    let selected: string | null = null
    api.readWorkspace.mockImplementation(async () => ({ selected }))
    api.watchConversation.mockImplementation(() => new Promise(() => {}))
    const view = render(<AiView mode="docked" actions={null} />)
    await act(async () => {})
    expect(api.watchConversation).not.toHaveBeenCalled()
    selected = 'later'
    await act(async () => { await vi.advanceTimersByTimeAsync(500) })
    expect(api.watchConversation).toHaveBeenCalledExactlyOnceWith('later', -1)
    view.unmount()
  } finally { vi.useRealTimers() }
})

it('ignores a rejected abandoned scope but reports failure of the current scope', async () => {
  let selected = 'first'
  api.readWorkspace.mockImplementation(async () => ({ selected }))
  const oldWait = deferred<unknown>()
  api.watchConversation.mockImplementation((id: string) => id === 'first' ? oldWait.promise : Promise.reject(new Error('Current scope failed')))
  render(<AiView mode="docked" actions={null} />)
  await waitFor(() => expect(api.watchConversation).toHaveBeenCalledWith('first', -1))
  selected = 'second'
  await act(async () => { oldWait.reject(new Error('Abandoned scope deleted')) })
  expect(await screen.findByRole('alert')).toHaveTextContent('Current scope failed')
  expect(screen.queryByText('Abandoned scope deleted')).toBeNull()
})

it('does not restart reads or adopt a pending response after unmount', async () => {
  api.readWorkspace.mockResolvedValue({ selected: 'first' })
  const waiting = deferred<unknown>()
  api.watchConversation.mockReturnValue(waiting.promise)
  const view = render(<AiView mode="docked" actions={null} />)
  await waitFor(() => expect(api.watchConversation).toHaveBeenCalledOnce())
  view.unmount()
  await act(async () => { waiting.resolve(single('first', 1, 'late')) })
  expect(api.readWorkspace).toHaveBeenCalledTimes(1)
  expect(api.watchConversation).toHaveBeenCalledTimes(1)
})

it('shows retained transcription receipt details', async () => {
  api.readWorkspace.mockResolvedValue({ selected: 'chat' })
  api.watchConversation.mockResolvedValueOnce({ ...single('chat', 1, 'reply'), transcriptionAttempts: [
    { id: 'stt', model: 'scribe_v2', state: 'failed', error: 'Provider refused transcription', diagnostics: { request_id: 'receipt-123', status: 403, error: { code: 'missing_permissions' } } },
  ] }).mockImplementation(() => new Promise(() => {}))
  render(<AiView mode="docked" actions={null} />)
  expect(await screen.findByText(/receipt-123/)).toHaveTextContent('missing_permissions')
})

it('adopts the place handed over by the other window', async () => {
  api.readWorkspace.mockResolvedValue({ selected: 'chat' })
  windowApi.getAiViewSelection.mockResolvedValue({ conversationId: 'chat', turnId: 'old', operationKind: 'persona_word_gloss' })
  api.watchConversation.mockResolvedValueOnce(snapshot('chat', 1, [
    turn('new', [{ id: 'new-reply', kind: 'persona_reply', state: 'running', dependencies: [] }]),
    turn('old', [{ id: 'old-reply', kind: 'persona_reply', state: 'succeeded', dependencies: [] }, { id: 'old-gloss', kind: 'persona_word_gloss', state: 'succeeded', dependencies: ['old-reply'] }]),
  ])).mockImplementation(() => new Promise(() => {}))
  render(<AiView mode="window" actions={null} />)
  await waitFor(() => expect(screen.getByTestId('graph')).toHaveTextContent('old-gloss'))
  expect(within(screen.getByRole('complementary', { name: 'Selected operation' })).getByRole('heading', { level: 3 })).toHaveTextContent('persona word gloss')
})

it.each(['window', 'docked'] as const)('restores a selection beyond the live page in %s mode before displaying a graph', async mode => {
  api.readWorkspace.mockResolvedValue({ selected: 'chat' })
  const selection = deferred<{ conversationId: string; turnId: string; operationKind: string }>()
  windowApi.getAiViewSelection.mockReturnValue(selection.promise)
  const recent = Array.from({ length: 50 }, (_, i) => turn(`turn-${100 - i}`, [{ id: `reply-${100 - i}`, kind: 'persona_reply', state: 'succeeded', dependencies: [] }]))
  api.watchConversation.mockResolvedValueOnce(snapshot('chat', 1, recent)).mockImplementation(() => new Promise(() => {}))
  const olderPage = deferred<unknown>()
  api.listTurnHistory.mockResolvedValueOnce({ turns: [turn('turn-50', [], [])], hasOlder: true }).mockReturnValueOnce(olderPage.promise)
  render(<AiView mode={mode} actions={null} />)
  await waitFor(() => expect(windowApi.getAiViewSelection).toHaveBeenCalledOnce())
  expect(windowApi.setAiViewSelection).not.toHaveBeenCalled()
  expect(screen.queryByTestId('graph')).toBeNull()
  await act(async () => { selection.resolve({ conversationId: 'chat', turnId: 'turn-10', operationKind: 'persona_reply' }) })
  await waitFor(() => expect(api.listTurnHistory).toHaveBeenLastCalledWith('chat', 'turn-50', 40))
  expect(screen.queryByTestId('graph')).toBeNull()
  expect(screen.getByRole('button', { name: 'Follow live' })).toHaveAttribute('aria-pressed', 'false')
  await act(async () => { olderPage.resolve({ turns: [turn('turn-10', [{ id: 'old-reply', kind: 'persona_reply', state: 'succeeded', dependencies: [] }])], hasOlder: false }) })
  await waitFor(() => expect(screen.getByTestId('graph')).toHaveTextContent('old-reply'))
  expect(windowApi.setAiViewSelection).toHaveBeenLastCalledWith({ conversationId: 'chat', turnId: 'turn-10', operationKind: 'persona_reply' })
})

it('reports restoration failures without substituting the newest exchange or retrying forever', async () => {
  api.readWorkspace.mockResolvedValue({ selected: 'chat' })
  windowApi.getAiViewSelection.mockResolvedValue({ conversationId: 'chat', turnId: 'old', operationKind: null })
  api.watchConversation.mockResolvedValueOnce(snapshot('chat', 1, Array.from({ length: 50 }, (_, i) => turn(`turn-${i}`, [], []))))
    .mockImplementation(() => new Promise(() => {}))
  api.listTurnHistory.mockRejectedValue(new Error('History unavailable'))
  render(<AiView mode="window" actions={null} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('History unavailable')
  expect(screen.queryByTestId('graph')).toBeNull()
  expect(api.listTurnHistory).toHaveBeenCalledOnce()
})

const definitions = [
  { id: 'first_graph', description: 'First declared graph', operations: [
    { kind: 'capture', dependencies: [], role: 'local', contractVersion: 1, description: 'Captures inputs', source: 'capture.rs', templates: [], outputSchema: null },
    { kind: 'generate', dependencies: ['capture'], role: 'standard', contractVersion: 2, description: 'Generates a reply', source: 'prompt.rs', templates: [{ label: 'system', text: 'Use {{targetLanguage}}.' }], outputSchema: { type: 'string' } },
  ] },
  { id: 'second_graph', description: 'Second declared graph', operations: [
    { kind: 'inspect', dependencies: [], role: 'fast', contractVersion: 3, description: 'Independent inspection', source: 'inspect.rs', templates: [{ label: 'system', text: 'Inspect {{sourceMessage}}.' }], outputSchema: null },
  ] },
]

it('explores definitions without a conversation, follows dependencies, and remembers manual graph selection', async () => {
  api.readWorkspace.mockResolvedValue({ selected: null })
  windowApi.getAiGraphDefinitions.mockResolvedValue(definitions)
  render(<AiView mode="docked" actions={null} />)
  const explore = screen.getByRole('button', { name: 'Graph definitions' })
  await waitFor(() => expect(explore).toBeEnabled())
  fireEvent.click(explore)
  const graph = await screen.findByRole('combobox', { name: 'Graph' })
  await waitFor(() => expect(screen.getByTestId('graph')).toHaveTextContent('"source":"capture","target":"generate"'))
  fireEvent.change(screen.getByRole('combobox', { name: 'Operation' }), { target: { value: 'generate' } })
  expect(await screen.findByText('Use {{targetLanguage}}.')).toBeVisible()
  fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: 'capture' }))
  expect(screen.getByRole('combobox', { name: 'Operation' })).toHaveValue('capture')
  fireEvent.change(graph, { target: { value: 'second_graph' } })
  expect(screen.getByTestId('graph')).toHaveTextContent('inspect')
  expect(screen.getByTestId('graph')).not.toHaveTextContent('generate')
  expect(screen.queryByRole('button', { name: 'Follow live' })).toBeNull()
  await waitFor(() => expect(windowApi.setAiViewSelection).toHaveBeenLastCalledWith({ conversationId: null, turnId: null, operationKind: null, definition: { graphId: 'second_graph', operationKind: null } }))
  fireEvent.click(screen.getByRole('button', { name: 'Recorded runs' }))
  fireEvent.click(screen.getByRole('button', { name: 'Graph definitions' }))
  expect(await screen.findByRole('combobox', { name: 'Graph' })).toHaveValue('second_graph')
  expect(api.watchConversation).not.toHaveBeenCalled()
  expect(api.readAttemptDetail).not.toHaveBeenCalled()
})

it.each(['window', 'docked'] as const)('restores a static graph and prompt in %s mode while live activity changes', async mode => {
  windowApi.getAiViewSelection.mockResolvedValue({ conversationId: null, turnId: null, operationKind: null, definition: { graphId: 'second_graph', operationKind: 'inspect' } })
  windowApi.getAiGraphDefinitions.mockResolvedValue(definitions)
  api.readWorkspace.mockResolvedValue({ selected: 'chat' })
  const update = deferred<unknown>()
  api.watchConversation.mockResolvedValueOnce(single('chat', 1, 'live_one')).mockReturnValueOnce(update.promise).mockImplementation(() => new Promise(() => {}))
  render(<AiView mode={mode} actions={null} />)
  expect(await screen.findByText('Inspect {{sourceMessage}}.')).toBeVisible()
  await act(async () => { update.resolve(single('chat', 2, 'live_two')) })
  expect(screen.getByRole('combobox', { name: 'Graph' })).toHaveValue('second_graph')
  expect(screen.getByTestId('graph')).toHaveTextContent('inspect')
  expect(screen.getByTestId('graph')).not.toHaveTextContent('live')
})

it('reports graph catalog failures and retries only when requested', async () => {
  api.readWorkspace.mockResolvedValue({ selected: null })
  windowApi.getAiViewSelection.mockResolvedValue({ conversationId: null, turnId: null, operationKind: null, definition: { graphId: 'second_graph', operationKind: null } })
  windowApi.getAiGraphDefinitions.mockRejectedValueOnce(new Error('Catalog unavailable')).mockResolvedValueOnce(definitions)
  render(<AiView mode="window" actions={null} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Catalog unavailable')
  expect(windowApi.getAiGraphDefinitions).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByText('Inspect {{sourceMessage}}.')).toBeVisible()
})


it('accepts an error link while already open and pins its operation in an older exchange', async () => {
  api.readWorkspace.mockResolvedValue({ selected: 'chat' })
  api.watchConversation.mockResolvedValueOnce(snapshot('chat', 1, [
    turn('latest', [{id:'latest-reply',kind:'persona_reply',state:'succeeded',dependencies:[]}]),
    turn('older', [{id:'old-help',kind:'reply_assistance',state:'failed',dependencies:[]}], [attempt('old-help', {state:'failed',error:'Invalid romanization'})]),
  ])).mockImplementation(() => new Promise(() => {}))
  render(<AiView mode="docked" actions={null} />)
  await waitFor(() => expect(screen.getByTestId('graph')).toHaveTextContent('latest-reply'))
  act(() => useNavigationStore.getState().inspectAi({conversationId:'chat',turnId:'older',operationKind:'reply_assistance'}))
  await waitFor(() => expect(screen.getByRole('complementary', {name:'Selected operation'})).toHaveTextContent('Invalid romanization'))
  expect(screen.getByTestId('graph')).toHaveTextContent('old-help')
  expect(useNavigationStore.getState().aiInspection).toBeNull()
  await waitFor(() => expect(windowApi.setAiViewSelection).toHaveBeenLastCalledWith({conversationId:'chat',turnId:'older',operationKind:'reply_assistance'}))
})

it('puts failed-node errors and provider reasons before long bodies and resets inspection scroll', async () => {
  api.readWorkspace.mockResolvedValue({ selected: 'chat' })
  api.readAttemptDetail.mockResolvedValue({ requestMessages: [{ role: 'user', content: 'Long recorded request '.repeat(100) }], responseText: null, previewText: null })
  api.watchConversation.mockResolvedValueOnce(snapshot('chat', 1, [turn('turn', [
    { id: 'assessment', kind: 'skill_assessment', state: 'failed', dependencies: [] },
    { id: 'gloss', kind: 'user_word_gloss', state: 'failed', dependencies: [] },
  ], [
    attempt('assessment', { state: 'failed', error: 'Skill assessment: quote does not bind to learner source' }),
    attempt('gloss', { state: 'failed', error: 'Word meanings rejected: gloss_invalid_termination.', diagnostics: {
      response: { id: 'provider-request', choices: [{ finish_reason: 'error', error: { code: 429, message: 'Model is temporarily rate-limited upstream.' } }] },
    } }),
  ])])).mockImplementation(() => new Promise(() => {}))
  render(<AiView mode="docked" actions={null} />)
  const gloss = await screen.findByTestId('node-gloss')
  const inspector = screen.getByRole('complementary', { name: 'Selected operation' })
  inspector.scrollTop = 900
  fireEvent.click(gloss)
  expect(inspector.scrollTop).toBe(0)
  const error = within(inspector).getByRole('alert')
  expect(error).toHaveTextContent('gloss_invalid_termination')
  expect(error).toHaveTextContent('429: Model is temporarily rate-limited upstream.')
  const request = await within(inspector).findByRole('heading', { name: 'Request' })
  expect(error.compareDocumentPosition(request) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(within(inspector).getByText('Response details').compareDocumentPosition(request) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  fireEvent.click(within(inspector).getByRole('button', { name: 'Open user word gloss in full view' }))
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByRole('alert')).toHaveTextContent('429: Model is temporarily rate-limited upstream.')
  expect(within(dialog).getByRole('alert').compareDocumentPosition(within(dialog).getByRole('heading', { name: 'Request' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})
