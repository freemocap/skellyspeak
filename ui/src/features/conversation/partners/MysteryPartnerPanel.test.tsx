// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ConversationSnapshot, Persona, RevealState } from '../../../generated/contracts'
import { blankPersona } from './personaLimits'
import { MysteryPartnerPanel } from './MysteryPartnerPanel'
const backend = vi.hoisted(() => ({ execute: vi.fn(), sound: vi.fn(), reload: vi.fn() }))
vi.mock('../../../platform/ipc/workspace', () => ({ executeAction: backend.execute, nativeError: String }))
vi.mock('../../../platform/audio/reward-sounds', () => ({ playRewardSound: backend.sound, unlockRewardAudio: vi.fn() }))
vi.mock('../../../state/learning/skill-evidence', () => ({ useSkillEvidenceStore: { getState: () => ({ reload: backend.reload }) } }))
const persona: Persona = { id: 'partner', learnerId: 'learner', languageId: 'es', revision: 2, details: { ...blankPersona(false), name: 'Alex', occupation: 'Architect', partnerType: 'mystery' } }
function snapshot(state: RevealState): ConversationSnapshot {
  return { sessionId: 'session', conversationId: 'chat', revision: 4, messages: [], mystery: { personaId: 'partner', personaRevision: 2, nudgeDismissed: false, fields: [{ field: 'occupation', state, xp: state === 'hidden' ? 0 : 1, value: state === 'revealed' ? 'Architect' : null }] } } as unknown as ConversationSnapshot
}
beforeEach(() => {
  vi.clearAllMocks()
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  backend.execute.mockResolvedValue({ entityId: 'correct' })
})
it('awards a correct guess but does not show the value until a separate durable reveal', async () => {
  const view = render(<MysteryPartnerPanel snapshot={snapshot('hidden')} persona={persona} />)
  expect(screen.queryByText('Architect')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Guess Occupation' }))
  fireEvent.click(screen.getByRole('button', { name: 'Architect' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(backend.execute).toHaveBeenCalledWith(expect.anything(), { kind: 'guessMystery', conversationId: 'chat', field: 'occupation', value: 'Architect', expectedPersonaRevision: 2 })
  expect(backend.sound).toHaveBeenCalledTimes(1)
  view.rerender(<MysteryPartnerPanel snapshot={snapshot('guessed_unrevealed')} persona={persona} />)
  expect(screen.queryByText('Architect')).toBeNull()
  expect(screen.getByRole('status')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Reveal' }))
  await waitFor(() => expect(backend.execute).toHaveBeenCalledWith(expect.anything(), { kind: 'revealMystery', conversationId: 'chat', field: 'occupation' }))
  view.rerender(<MysteryPartnerPanel snapshot={snapshot('revealed')} persona={persona} />)
  expect(screen.getByText(/Architect/)).toBeVisible()
  expect(backend.sound).toHaveBeenCalledTimes(1)
})
it('keeps incorrect guesses open without awarding XP or automatically retrying', async () => {
  backend.execute.mockResolvedValue({ entityId: 'incorrect' })
  render(<MysteryPartnerPanel snapshot={snapshot('hidden')} persona={persona} />)
  fireEvent.click(screen.getByRole('button', { name: 'Guess Occupation' }))
  fireEvent.click(screen.getByRole('button', { name: 'Teacher' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Not correct.')
  expect(backend.sound).not.toHaveBeenCalled()
  expect(backend.execute).toHaveBeenCalledTimes(1)
})
