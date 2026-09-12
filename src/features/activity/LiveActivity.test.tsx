// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { LiveActivity } from './LiveActivity'
const api = vi.hoisted(() => ({ readWorkspace: vi.fn(), watchConversation: vi.fn() }))
vi.mock('../../platform/ipc/workspace', () => ({ ...api, selectedConversation: () => ({ id: 'chat' }), nativeError: String }))
vi.mock('@xyflow/react', () => ({ ReactFlow: ({ nodes, edges }: { nodes: unknown[]; edges: unknown[] }) => <pre data-testid="graph">{JSON.stringify({ nodes, edges })}</pre>, Background: () => null, Controls: () => null }))
it('renders actual dependency IDs and watches updates without dispatching AI', async () => {
  api.readWorkspace.mockResolvedValue({})
  api.watchConversation.mockResolvedValueOnce({ conversationId: 'chat', revision: 2, turns: [{ id: 'turn', state: 'assisting', attempts: [], operations: [{ id: 'reply', kind: 'partner_reply', state: 'done', dependencies: [] }, { id: 'gloss', kind: 'partner_word_gloss', state: 'running', dependencies: ['reply'] }] }] }).mockImplementation(() => new Promise(() => {}))
  render(<LiveActivity />)
  await waitFor(() => expect(screen.getByTestId('graph')).toHaveTextContent('partner word gloss · running'))
  expect(screen.getByTestId('graph')).toHaveTextContent('"source":"reply","target":"gloss"')
  expect(api.watchConversation).toHaveBeenLastCalledWith('chat', 2)
})
