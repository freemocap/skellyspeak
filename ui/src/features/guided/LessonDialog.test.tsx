// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LessonDialog } from './LessonDialog'
import type { ConversationSnapshot, LessonView } from '../../generated/contracts'

const backend = vi.hoisted(() => ({ execute: vi.fn() }))
vi.mock('../../platform/ipc/workspace', () => ({ executeAction: backend.execute, nativeError: (error: unknown) => String(error) }))
vi.mock('../../platform/ipc/tauri', () => ({ languageFor: () => null }))
vi.mock('../../domain/input/back', () => ({ openOverlay: () => () => {} }))
const lesson: LessonView = {
  category: 'practical', quizAnswers: [], id: 'lesson', topic: 'Meeting times', status: 'ready', exposed: true, recap: null, error: null, operationId: 'generate', handoffTurnId: null, coachTurnIds: [],
  plan: { quiz: [{ question: 'Which time?', options: ['Two', 'Four', 'Six'], correctOption: 0, explanation: 'Dos means two.' }, { question: 'Which agrees?', options: ['Yes', 'No', 'Never'], correctOption: 0, explanation: 'Yes agrees.' }], title: 'Arrange a meeting', objective: 'Agree on a time.', explanation: 'Use a question to suggest a time.', examples: [{ text: '¿A las dos?', translation: 'At two?', romanization: null, pronunciation: null }, { text: 'A las tres.', translation: 'At three.', romanization: null, pronunciation: null }], exercise: 'Suggest a time.', feedbackGuidance: 'Explain privately.', situation: 'Arrange a meeting.', completionCriteria: 'Agree on a time.' },
}
const base = { sessionId: 'session', conversationId: 'chat', revision: 4, lessons: [], lessonChoices: [{ id: 'meeting', label: 'Meeting times', reason: 'From your focus', preview: null, translation: null }], turns: [], coachMessages: [] } as unknown as ConversationSnapshot
const beforeAction = vi.fn().mockResolvedValue(undefined)
beforeEach(() => {
  vi.clearAllMocks()
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  backend.execute.mockResolvedValue({ entityId: 'lesson' })
})
function ui(snapshot = base, onClose = vi.fn()) { return <LessonDialog snapshot={snapshot} busy={false} beforeAction={beforeAction} onClose={onClose} /> }
it('opens the chooser without inference and generates only the selected topic', async () => {
  render(ui()); expect(backend.execute).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Meeting times' }))
  await waitFor(() => expect(backend.execute).toHaveBeenCalledTimes(1))
  expect(backend.execute).toHaveBeenCalledWith(base, { kind: 'generateLesson', category: 'practical', choiceId: 'meeting', conversationId: 'chat', topic: 'Meeting times', expectedRevision: 4 })
})
it('keeps custom input on failure and does not retry automatically', async () => {
  backend.execute.mockRejectedValue(new Error('Admission held'))
  render(ui()); fireEvent.change(screen.getByLabelText('Request a topic'), { target: { value: 'Ask for directions' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create lesson' }))
  await screen.findByRole('alert')
  expect(screen.getByLabelText('Request a topic')).toHaveValue('Ask for directions')
  expect(backend.execute).toHaveBeenCalledTimes(1)
})
it('reopens saved content without generation and hands off without requiring the exercise', async () => {
  const onClose = vi.fn(); render(ui({ ...base, lessons: [lesson] }, onClose))
  fireEvent.click(screen.getByRole('button', { name: 'Arrange a meeting' }))
  expect(screen.getByText('Agree on a time.')).toBeVisible()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Try it in chat' })).toBeEnabled())
  expect(backend.execute).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ kind: 'controlLesson', control: 'open' }))
  fireEvent.click(screen.getByRole('button', { name: 'Try it in chat' }))
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  expect(backend.execute).toHaveBeenCalledWith(expect.anything(), { kind: 'controlLesson', conversationId: 'chat', lessonId: 'lesson', control: 'practice', expectedRevision: 4 })
})
it('records exposure before showing newly generated examples', async () => {
  const unseen = { ...base, lessons: [{ ...lesson, exposed: false }] }
  const view = render(ui(unseen)); fireEvent.click(screen.getByRole('button', { name: 'Arrange a meeting' }))
  await waitFor(() => expect(backend.execute).toHaveBeenCalledTimes(1))
  expect(screen.queryByText('¿A las dos?')).toBeNull()
  view.rerender(ui({ ...unseen, revision: 5, lessons: [lesson] }))
  expect(screen.getByText('¿A las dos?')).toBeVisible()
  expect(backend.execute).toHaveBeenCalledTimes(1)
})
it('asks about the selected lesson privately and retains an unsuccessful question', async () => {
  backend.execute.mockResolvedValueOnce({ entityId: 'lesson' }).mockRejectedValue(new Error('Connection changed'))
  render(ui({ ...base, lessons: [lesson] })); fireEvent.click(screen.getByRole('button', { name: 'Arrange a meeting' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Try it in chat' })).toBeEnabled())
  fireEvent.change(screen.getByLabelText('Ask the coach or try the exercise'), { target: { value: 'Why use a las?' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ask the coach' }))
  await screen.findByRole('alert')
  expect(backend.execute).toHaveBeenCalledWith(expect.anything(), { kind: 'askLessonCoach', conversationId: 'chat', lessonId: 'lesson', text: 'Why use a las?', expectedRevision: 4 })
  expect(screen.getByLabelText('Ask the coach or try the exercise')).toHaveValue('Why use a las?')
  expect(screen.queryByText('Explain privately.')).toBeNull()
})

it('offers grammar and language background topics without generating on category selection', async () => {
  render(ui())
  fireEvent.click(screen.getByRole('radio', { name: 'Grammar' }))
  expect(backend.execute).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Meeting times' })).toBeNull()
  fireEvent.click(screen.getByRole('radio', { name: 'About the language' }))
  fireEvent.click(screen.getByRole('button', { name: 'History and language family' }))
  await waitFor(() => expect(backend.execute).toHaveBeenCalledWith(base, expect.objectContaining({ kind: 'generateLesson', category: 'aboutLanguage', choiceId: null, topic: 'History and language family' })))
})
it('submits only the selected answer and shows saved zero-XP feedback without blocking chat', async () => {
  const view = render(ui({ ...base, lessons: [lesson] }))
  fireEvent.click(screen.getByRole('button', { name: 'Arrange a meeting' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Four' })).toBeEnabled())
  expect(screen.queryByText('Dos means two.')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Four' }))
  await waitFor(() => expect(backend.execute).toHaveBeenCalledWith(expect.anything(), { kind: 'answerLessonQuiz', conversationId: 'chat', lessonId: 'lesson', questionIndex: 0, optionIndex: 1 }))
  view.rerender(ui({ ...base, lessons: [{ ...lesson, quizAnswers: [{ questionIndex: 0, optionIndex: 1, correct: false, xp: 0 }] }] }))
  expect(screen.getByText('0 XP')).toBeVisible()
  expect(screen.getByText('Dos means two.')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Four' })).toBeDisabled()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Try it in chat' })).toBeEnabled())
})

it('offers reading topics and preserves the reading category for custom requests', async () => {
  render(ui())
  fireEvent.click(screen.getByRole('radio', { name: 'Reading' }))
  expect(backend.execute).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Letters and sounds' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Reading words' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Pronunciation and stress' })).toBeVisible()
  fireEvent.change(screen.getByLabelText('Request a topic'), { target: { value: 'How to read ñ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create lesson' }))
  await waitFor(() => expect(backend.execute).toHaveBeenCalledWith(base, expect.objectContaining({ kind: 'generateLesson', category: 'reading', choiceId: null, topic: 'How to read ñ' })))
})

it('keeps an embedded exercise draft while visiting completed steps and never mounts a dialog', async () => {
  render(<LessonDialog embedded snapshot={{ ...base, lessons: [lesson] }} busy={false} beforeAction={beforeAction} onClose={vi.fn()} />)
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Arrange a meeting' }))
  await waitFor(() => expect(backend.execute).toHaveBeenCalledTimes(1))
  expect(screen.getByRole('button', { name: 'Quiz' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Next step' }))
  expect(screen.getByText('¿A las dos?')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Next step' }))
  fireEvent.change(screen.getByLabelText('Ask the coach or try the exercise'), { target: { value: 'My unsent exercise' } })
  fireEvent.click(screen.getByRole('button', { name: 'Objective' }))
  expect(screen.getByText('Agree on a time.')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Exercise' }))
  expect(screen.getByLabelText('Ask the coach or try the exercise')).toHaveValue('My unsent exercise')
  expect(backend.execute).toHaveBeenCalledTimes(1)
})

it('preserves a newer lesson question while the submitted receipt is pending', async () => {
  let resolve!: (receipt: { entityId: string }) => void
  backend.execute.mockResolvedValueOnce({ entityId: 'lesson' }).mockImplementationOnce(() => new Promise(done => { resolve = done }))
  render(ui({ ...base, lessons: [lesson] }))
  fireEvent.click(screen.getByRole('button', { name: 'Arrange a meeting' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Ask the coach' })).toBeDisabled())
  const input = screen.getByLabelText('Ask the coach or try the exercise')
  fireEvent.change(input, { target: { value: 'First question' } })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Ask the coach' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Ask the coach' }))
  await waitFor(() => expect(backend.execute).toHaveBeenCalledTimes(2))
  fireEvent.change(input, { target: { value: 'Next draft' } })
  resolve({ entityId: 'lesson' })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Ask the coach' })).toBeEnabled())
  expect(input).toHaveValue('Next draft')
  expect(backend.execute).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ text: 'First question' }))
})
