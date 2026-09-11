// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useState } from 'react'
import App from './App'

vi.mock('./hooks/useIsMobile', () => ({ useIsMobile: () => true }))
vi.mock('./hooks/useAiActivity', () => ({ useAiActivity: () => false }))
vi.mock('./hooks/useSkillEvidence', async importOriginal => ({ ...await importOriginal<typeof import('./hooks/useSkillEvidence')>(), useSkillEvidence: () => ({ snapshot: null, error: null }) }))
vi.mock('./lib/tauri', () => ({ isTauri: true, takeStartupFaults: async () => [], getSettings: async () => ({ native_language: 'en', target_language: 'es', provider_mode: 'custom' }), languageFor: () => null, languages: () => [] }))
vi.mock('./components/UpdateBanner', () => ({ UpdateBanner: () => null }))
vi.mock('./components/PausedBanner', () => ({ PausedBanner: () => null }))
vi.mock('./components/SettingsModal', () => ({ SettingsModal: () => null }))
vi.mock('./pages/SkillsPage', () => ({ default: ({ onPractice }: { onPractice: () => void }) => <button onClick={onPractice}>Practice this skill</button> }))
vi.mock('./pages/GuidedPage', () => ({ default: ({ mobileSurface }: { mobileSurface: string }) => {
  const [draft, setDraft] = useState('')
  return <><p>Practice surface: {mobileSurface}</p><input aria-label="Draft" value={draft} onChange={event => setDraft(event.target.value)} /></>
} }))

it('keeps Chat and Lesson reachable through Skill Tree and preserves the chat draft', async () => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
  render(<App />)
  const nav = screen.getByRole('navigation', { name: 'Main navigation' })
  expect(within(nav).getAllByRole('button').map(button => button.textContent)).toEqual(['Chat', 'Lesson'])
  expect(screen.queryByText('Guided conversation')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'Keep my words' } })
  for (const destination of ['Chat', 'Lesson']) {
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    fireEvent.click(screen.getByRole('button', { name: 'Skill tree' }))
    await screen.findByRole('button', { name: 'Practice this skill' })
    fireEvent.click(within(nav).getByRole('button', { name: destination }))
    expect(within(nav).getByRole('button', { name: destination })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByLabelText('Draft')).toHaveValue('Keep my words')
    expect(screen.getByText(`Practice surface: ${destination === 'Chat' ? 'chat' : 'panel'}`)).toBeInTheDocument()
  }
  fireEvent.click(within(nav).getByRole('button', { name: 'Lesson' }))
  fireEvent.click(screen.getByRole('button', { name: 'SkellySpeak home — Chat' }))
  expect(within(nav).getByRole('button', { name: 'Chat' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByLabelText('Draft')).toHaveValue('Keep my words')
  fireEvent.click(screen.getByRole('button', { name: 'More' }))
  fireEvent.click(screen.getByRole('button', { name: 'AI activity & tools' }))
  expect(screen.getByText('AI activity graph is not connected.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Close AI activity & tools' }))
  expect(screen.queryByText('AI activity graph is not connected.')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Draft')).toHaveValue('Keep my words')
})
