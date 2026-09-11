// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Snapshot } from '../contracts'
import { PersonaField } from './PersonaField'
import { PersonaSummary } from './PersonaSummary'
import { readWorkspace, executeAction } from '../lib/workspace'
vi.mock('../lib/workspace', () => ({ readWorkspace: vi.fn(), executeAction: vi.fn(), nativeError: String }))
const snapshot = {
  sessionId: 'session',
  conversations: [{ id: 'chat', relationshipId: 'relationship', languageId: 'es' }],
  relationships: [{ id: 'relationship', partnerId: 'partner', archived: false }, { id: 'other-relationship', partnerId: 'other', archived: false }],
  partners: [
    { id: 'partner', languageId: 'es', details: { name: 'Carmen', background: 'Bakes bread.', tendencies: '', vibe: [] } },
    { id: 'other', languageId: 'es', details: { name: 'Luis', background: '', tendencies: '', vibe: [] } },
  ],
} as unknown as Snapshot
beforeEach(() => { vi.clearAllMocks(); vi.mocked(readWorkspace).mockResolvedValue(snapshot); vi.mocked(executeAction).mockResolvedValue({ actionId: 'a', entityId: 'new-chat', revision: 2 }) })
afterEach(cleanup)
describe('native partner identity', () => {
  it('reads actual partner without generating work when details are opened', async () => {
    render(<PersonaField chatId="chat" onChange={vi.fn()} />)
    await screen.findByText('Carmen (current conversation)')
    fireEvent.click(screen.getByRole('button', { name: 'Partner details' }))
    expect(screen.getByText('Bakes bread.')).toBeTruthy()
    expect(executeAction).not.toHaveBeenCalled()
  })
  it('creates partner and conversation atomically for dice', async () => {
    const selected = vi.fn()
    render(<PersonaField chatId="chat" onChange={selected} />)
    await screen.findByText('Carmen (current conversation)')
    fireEvent.click(screen.getByRole('button', { name: 'New partner' }))
    await waitFor(() => expect(selected).toHaveBeenCalledWith('new-chat'))
    expect(executeAction).toHaveBeenCalledExactlyOnceWith(snapshot, { kind: 'startChat', languageId: 'es' })
  })
  it('uses relationship identity to create a conversation for an existing partner', async () => {
    render(<PersonaField chatId="chat" onChange={vi.fn()} />)
    await screen.findByText('Carmen (current conversation)')
    fireEvent.change(screen.getByRole('combobox', { name: 'Partner' }), { target: { value: 'other' } })
    await waitFor(() => expect(executeAction).toHaveBeenCalledWith(snapshot, { kind: 'createConversation', relationshipId: 'other-relationship', title: 'New conversation' }))
  })
  it('surfaces command failure without selecting a fabricated conversation', async () => {
    vi.mocked(executeAction).mockRejectedValue(new Error('Denied'))
    const selected = vi.fn()
    render(<PersonaField chatId="chat" onChange={selected} />)
    await screen.findByText('Carmen (current conversation)')
    fireEvent.click(screen.getByRole('button', { name: 'New partner' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Denied')
    expect(selected).not.toHaveBeenCalled()
  })
  it('summary follows conversation relationship rather than template ID', async () => {
    render(<PersonaSummary chatId="chat" />)
    expect(await screen.findByText('· Persona: Carmen')).toBeTruthy()
    expect(executeAction).not.toHaveBeenCalled()
  })
})
