import { TopicNotesProvider } from './TopicNotesProvider'
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render as testingRender, screen, waitFor } from '@testing-library/react'
import { CoachAnalysisPanel } from './CoachAnalysisPanel'
import type { LessonChoices, LessonState } from '../../types'

const backend = vi.hoisted(() => ({ invoke: vi.fn(), listen: vi.fn(async () => () => {}) }))
vi.mock('../../lib/tauri', () => ({ isTauri: true, invoke: backend.invoke }))
vi.mock('../../lib/back', () => ({ openOverlay: () => () => {} }))
vi.mock('@tauri-apps/api/event', () => ({ listen: backend.listen }))
const choices: LessonChoices = { goal: 'Travel stories', preferences: [], correction_budget: 1 }
const initial: LessonState = { revision: 0, choices: { goal: '', preferences: [], correction_budget: null }, changes: [] }
const prepareContext = vi.fn(async () => {})
function mount() {
  return render(<CoachAnalysisPanel level="zero" topic="" chatId="chat-1" prepareContext={prepareContext} conversationBusy={false} plan={null} profile={null} observationStatus="Observations pending" tab="lesson" onTab={vi.fn()} draftQuestion="" onDraftConsumed={vi.fn()} pinnedTurn={null} inspect={null} nativeLanguageName="English" showRomanization={false} rtl={false} />)
}
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function (): void { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function (): void { this.removeAttribute('open') }
  vi.clearAllMocks()
  backend.invoke.mockImplementation(async (command: string) => {
    if (command === 'get_lesson') return initial
    if (command === 'get_coach_thread') return []
    throw new Error(`Unexpected command ${command}`)
  })
})
describe('lesson coaching', () => {
  it('shows useful topic content and drafts follow-up without sending it', async () => {
    backend.invoke.mockImplementation(async (command: string) => {
      if (command === 'get_lesson') return { ...initial, choices }
      if (command === 'get_coach_thread') return []
      if (command === 'lesson_topic_note') return { explanation: 'Describe one place you visit.', example: 'Voy a Madrid.', translation: 'I go to Madrid.' }
      throw new Error(command)
    })
    mount()
    fireEvent.click(await screen.findByText('Explore this focus'))
    expect(await screen.findByText('Describe one place you visit.')).toBeVisible()
    expect(screen.getByText('Voy a Madrid.')).toBeVisible()
    expect(screen.getByText('I go to Madrid.')).toBeVisible()
    expect(screen.getByText('Preferences & coach memory').closest('details')).not.toHaveAttribute('open')
    fireEvent.click(screen.getByRole('button', { name: 'Why this?' }))
    expect(screen.getByLabelText('Message your coach')).toHaveValue('Why are we practising Travel stories? Explain what in my conversation supports this focus.')
    expect(backend.invoke).toHaveBeenCalledWith('lesson_topic_note', { chatId: 'chat-1', topic: 'Travel stories', level: 'zero' })
    expect(backend.invoke.mock.calls.some(([command]) => command === 'coach_ask' || command === 'save_lesson')).toBe(false)
  })
  it('does not apply a suggestion until the learner accepts it', async () => {
    backend.invoke.mockImplementation(async (command: string) => {
      if (command === 'get_lesson') return initial
      if (command === 'get_coach_thread') return []
      if (command === 'coach_ask') return { reply: 'Try travel stories?', proposal: choices, lesson: initial }
      if (command === 'save_lesson') return { ...initial, revision: 1, choices }
      throw new Error(command)
    })
    mount()
    await screen.findByRole('button', { name: 'Edit choices' })
    fireEvent.change(screen.getByLabelText('Message your coach'), { target: { value: 'What should I practise?' } })
    fireEvent.click(screen.getByLabelText('Send to coach'))
    await screen.findByText('Suggested change · not applied')
    expect(prepareContext).toHaveBeenCalledTimes(1)
    expect(backend.invoke).toHaveBeenCalledWith('coach_ask', { question: 'What should I practise?', chatId: 'chat-1', level: 'zero', topic: '', expectedRevision: 0 })
    expect(backend.invoke.mock.calls.some(([command]) => command === 'save_lesson')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Apply suggestion' }))
    await waitFor(() => expect(backend.invoke).toHaveBeenCalledWith('save_lesson', { chatId: 'chat-1', expectedRevision: 0, choices }))
    await screen.findByRole('heading', { name: 'Travel stories' })
  })
  it('shows applied choices immediately and preserves the question on failure', async () => {
    backend.invoke.mockImplementation(async (command: string) => {
      if (command === 'get_lesson') return initial
      if (command === 'get_coach_thread') return []
      if (command === 'coach_ask') throw new Error('Lesson changed while answering')
      throw new Error(command)
    })
    mount()
    await screen.findByRole('button', { name: 'Edit choices' })
    fireEvent.change(screen.getByLabelText('Message your coach'), { target: { value: 'Focus on travel' } })
    fireEvent.click(screen.getByLabelText('Send to coach'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Lesson changed while answering')
    expect(screen.getByLabelText('Message your coach')).toHaveValue('Focus on travel')
    expect(screen.queryByRole('heading', { name: 'Travel stories' })).not.toBeInTheDocument()
  })
  it('saves edits against the revision that was opened, even after a refresh', async () => {
    mount()
    await screen.findByRole('button', { name: 'Edit choices' })
    fireEvent.click(screen.getByRole('button', { name: 'Edit choices' }))
    fireEvent.change(screen.getByLabelText('Your learning goal'), { target: { value: 'Tell stories' } })
    backend.invoke.mockImplementation(async (command: string) => {
      if (command === 'save_lesson') throw new Error('The lesson changed while you were editing')
      if (command === 'get_lesson') return { ...initial, revision: 1, choices }
      throw new Error(command)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect((await screen.findAllByRole('alert'))[0]).toHaveTextContent('lesson changed')
    expect(screen.getByLabelText('Your learning goal')).toHaveValue('Tell stories')
    expect(backend.invoke).toHaveBeenCalledWith('save_lesson', { chatId: 'chat-1', expectedRevision: 0, choices: { goal: 'Tell stories', preferences: [], correction_budget: null } })
  })
})

function render(ui: React.ReactNode) { return testingRender(ui, { wrapper: ({ children }) => <TopicNotesProvider scope="test">{children}</TopicNotesProvider> }) }

it('opens a chat-originated coach question in a dialog and preserves its draft on close', async () => {
  render(<CoachAnalysisPanel level="zero" topic="" chatId="chat-1" prepareContext={prepareContext} conversationBusy={false} plan={null} profile={null} observationStatus="" tab="lesson" onTab={vi.fn()} draftQuestion="Explain this phrase" onDraftConsumed={vi.fn()} pinnedTurn={null} inspect={null} nativeLanguageName="English" showRomanization={false} rtl={false} />)
  expect(await screen.findByRole('dialog', { name: 'Coach conversation' })).toBeVisible()
  expect(screen.getByLabelText('Message your coach')).toHaveValue('Explain this phrase')
  fireEvent.click(screen.getByRole('button', { name: 'Close Coach conversation' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByLabelText('Message your coach')).toHaveValue('Explain this phrase')
  expect(backend.invoke.mock.calls.some(([command]) => command === 'coach_ask')).toBe(false)
})
