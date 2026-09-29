// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import { ConversationStart } from './ConversationStart'
import { SkillEvidenceContext } from '../../../state/learning/useSkillEvidence'
import type { SkillSnapshot } from '../../../domain/learning/evidence/skills'
import type { ConversationStartConfig, SavedTopic, TopicCard } from '../../../generated/contracts'
const workspace = vi.hoisted(() => ({ read: vi.fn(), execute: vi.fn() }))
vi.mock('../../../platform/ipc/workspace', async importOriginal => ({ ...(await importOriginal<object>()), readWorkspace: workspace.read, executeAction: workspace.execute }))
const topics: TopicCard[] = [{ id: 'food', glyph: '☕', target: 'الطعام والشراب', romanized: 'aṭ-ṭaʿām wa-al-sharāb', translation: 'Food and drink' }]
const value: ConversationStartConfig = { difficulty: 'beginner', varietyId: 'arabic-levantine', direction: { topic: null, timeReference: 'any', usePersonaDetails: true } }
const props = {
  topics, busy: false, conversationId: 'conversation', value, onChange: vi.fn(), partnerName: 'Nūr',
  recording: false, transcribing: false, canPartnerStart: true,
}
let saved: SavedTopic[] = []
beforeEach(() => {
  saved = []
  workspace.read.mockReset().mockImplementation(async () => ({ savedTopics: saved, sessionId: 'session', revision: 4 }))
  workspace.execute.mockReset().mockResolvedValue({})
})
/** Evidence with one skill practised, which is what offers a skill focus. */
function withPractice(element: ReactElement) {
  const snapshot = { profile: { skills: [{ skill_id: 'past', experience: 2, effort: 1, xp: 3, checked: true, star: false }] } } as unknown as SkillSnapshot
  return <SkillEvidenceContext value={{ snapshot, error: null }}>{element}</SkillEvidenceContext>
}
function withTopic(topic: NonNullable<ConversationStartConfig['direction']['topic']>): ConversationStartConfig {
  return { ...value, direction: { ...value.direction, topic } }
}
function openOptions() {
  const toggle = screen.getByRole('button', { name: /^Options/ })
  fireEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
}

it('starts with the partner in one press', async () => {
  const start = vi.fn().mockResolvedValue(undefined)
  render(<ConversationStart {...props} onStart={start} />)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Nūr starts' })))
  expect(start).toHaveBeenCalledExactlyOnceWith(value)
})
it('starts with a topic in one press, leaving the draft as it was', async () => {
  const start = vi.fn().mockResolvedValue(undefined)
  const change = vi.fn()
  render(<ConversationStart {...props} onStart={start} onChange={change} />)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /الطعام والشراب/ })))
  expect(start).toHaveBeenCalledExactlyOnceWith(withTopic({ kind: 'builtin', id: 'food' }))
  expect(change).not.toHaveBeenCalled()
  // The partner choosing is what the partner's own start means; there is no separate choice for it.
  expect(screen.queryByRole('button', { name: /chooses/ })).toBeNull()
})
it('names each topic in the target language, set apart, then romanized and in the explanation language', async () => {
  saved = [{ id: 'saved-1', text: 'Mi barrio' }]
  render(<ConversationStart {...props} onStart={vi.fn()} targetTag="ar" targetDir="rtl" />)
  const topic = screen.getByRole('button', { name: /الطعام والشراب/ })
  // Romanization is Latin inside an Arabic topic and must say so itself.
  expect(topic.querySelector('.topic-start-roman bdi')).toHaveAttribute('dir', 'ltr')
  expect(topic.querySelector('.topic-start-target bdi')).toHaveAttribute('dir', 'rtl')
  expect(topic.querySelector('.topic-start-target bdi')).toHaveAttribute('lang', 'ar')
  // The target-language name scans apart from its translation.
  expect(topic.querySelector('.topic-start-target')).toHaveClass('target-word')
  expect(topic.querySelector('.topic-start-translation')).not.toHaveClass('target-word')
  expect(topic).toHaveTextContent('Food and drink')
  // A saved topic is the learner's own words, whatever language they wrote.
  expect((await screen.findByRole('button', { name: 'Mi barrio' })).querySelector('.target-word')).toBeNull()
})
it('puts the options first, then the partner and every start', () => {
  render(<ConversationStart {...props} onStart={vi.fn()} />)
  const order = [screen.getByRole('button', { name: /^Options/ }), screen.getByRole('button', { name: 'Nūr starts' }), screen.getByRole('button', { name: /الطعام والشراب/ }),
    screen.getByRole('textbox', { name: 'Your own topic' }), screen.getByRole('checkbox', { name: 'Save for later' }), screen.getByText('…or send a message to begin')]
  for (let index = 1; index < order.length; index++) expect(Boolean(order[index - 1].compareDocumentPosition(order[index]) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
  // The field is named by its placeholder, with no heading of its own.
  expect(screen.getByRole('textbox', { name: 'Your own topic' })).toHaveAttribute('placeholder', 'Enter your own topic…')
})
it('shows the skill to work on as coming soon, until conversations can carry one', () => {
  render(<ConversationStart {...props} onStart={vi.fn()} />)
  openOptions()
  const skill = screen.getByRole('combobox', { name: 'Skill' })
  expect(skill).toBeDisabled()
  expect(skill).toHaveAccessibleDescription('Coming soon')
  expect(skill.closest('[title]')).toHaveAttribute('title', 'Coming soon')
})
it('lists topics saved for later, each starting in one press', async () => {
  saved = [{ id: 'saved-1', text: 'Mi barrio' }]
  const start = vi.fn().mockResolvedValue(undefined)
  render(<ConversationStart {...props} onStart={start} />)
  const topic = await screen.findByRole('button', { name: 'Mi barrio' })
  await act(async () => fireEvent.click(topic))
  expect(start).toHaveBeenCalledExactlyOnceWith(withTopic({ kind: 'custom', text: 'Mi barrio' }))
})
it('starts with your own topic from its field, saving it for later when asked', async () => {
  const start = vi.fn().mockResolvedValue(undefined)
  render(<ConversationStart {...props} onStart={start} />)
  await waitFor(() => expect(workspace.read).toHaveBeenCalled())
  const field = screen.getByRole('textbox', { name: 'Your own topic' })
  expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled()
  fireEvent.change(field, { target: { value: '  Mi calle  ' } })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Save for later' }))
  // Enter in the field starts, as the button does.
  await act(async () => fireEvent.submit(field.closest('form')!))
  expect(workspace.execute).toHaveBeenCalledWith(expect.objectContaining({ revision: 4 }), { kind: 'saveTopics', additions: ['Mi calle'], deletions: [], expectedRevision: 4 })
  expect(start).toHaveBeenCalledExactlyOnceWith(withTopic({ kind: 'custom', text: 'Mi calle' }))
})
it('does not save a topic that is already saved, and does not start with an invalid one', async () => {
  saved = [{ id: 'saved-1', text: 'Mi barrio' }]
  const start = vi.fn().mockResolvedValue(undefined)
  render(<ConversationStart {...props} onStart={start} />)
  await screen.findByRole('button', { name: 'Mi barrio' })
  const field = screen.getByRole('textbox', { name: 'Your own topic' })
  fireEvent.change(field, { target: { value: 'x'.repeat(501) } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Start' })))
  expect(screen.getByRole('alert')).toHaveTextContent('Enter a topic of 1–500 characters.')
  expect(start).not.toHaveBeenCalled()
  fireEvent.change(field, { target: { value: 'Mi barrio' } })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Save for later' }))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Start' })))
  expect(workspace.execute).not.toHaveBeenCalled()
  expect(start).toHaveBeenCalledExactlyOnceWith(withTopic({ kind: 'custom', text: 'Mi barrio' }))
})
it('keeps the options in a panel that says what they are set to; they only update the draft', () => {
  const start = vi.fn()
  const change = vi.fn()
  const { rerender } = render(<ConversationStart {...props} onStart={start} onChange={change} />)
  const toggle = screen.getByRole('button', { name: /^Options/ })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(toggle).toHaveTextContent('Beginner · Any time frame')
  openOptions()
  fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Time frame' })).getByRole('radio', { name: 'Past events' }))
  expect(change).toHaveBeenLastCalledWith({ ...value, direction: { ...value.direction, timeReference: 'past' } })
  fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Difficulty' })).getByRole('radio', { name: 'Absolute zero' }))
  expect(change).toHaveBeenLastCalledWith({ ...value, difficulty: 'absolute_zero' })
  expect(start).not.toHaveBeenCalled()
  rerender(<ConversationStart {...props} value={{ ...value, difficulty: 'advanced', direction: { ...value.direction, timeReference: 'future' } }} onStart={start} onChange={change} />)
  expect(toggle).toHaveTextContent('Advanced · Future plans')
})
it('names a topic set in Prompt details beside the options it starts with', () => {
  render(<ConversationStart {...props} value={withTopic({ kind: 'builtin', id: 'food' })} onStart={vi.fn()} />)
  expect(screen.getByRole('button', { name: /^Options/ })).toHaveTextContent('الطعام والشراب · Beginner · Any time frame')
})
it('offers a skill focus once there is recorded practice, and the partner starts with it', async () => {
  const change = vi.fn()
  const start = vi.fn().mockResolvedValue(undefined)
  const { rerender } = render(<ConversationStart {...props} onStart={start} onChange={change} />)
  // Nothing recorded yet: a focus would have nothing to choose from.
  expect(screen.queryByRole('radiogroup', { name: 'Skill focus' })).toBeNull()
  rerender(withPractice(<ConversationStart {...props} onStart={start} onChange={change} />))
  openOptions()
  const focus = screen.getByRole('radiogroup', { name: 'Skill focus' })
  expect(within(focus).getByRole('radio', { name: 'No focus' })).toHaveAttribute('aria-checked', 'true')
  fireEvent.click(within(focus).getByRole('radio', { name: 'Explore' }))
  const explore = withTopic({ kind: 'coach', mode: 'explore' })
  expect(change).toHaveBeenLastCalledWith(explore)
  rerender(withPractice(<ConversationStart {...props} value={explore} onStart={start} onChange={change} />))
  expect(screen.getByRole('button', { name: /^Options/ })).toHaveTextContent('Beginner · Any time frame · Explore')
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Nūr starts' })))
  expect(start).toHaveBeenCalledExactlyOnceWith(explore)
})
it('shows the default coach choice before any practice is recorded', () => {
  render(<ConversationStart {...props} value={withTopic({ kind: 'coach', mode: 'coachChoice' })} onStart={vi.fn()} />)
  expect(screen.getByRole('button', { name: /^Options/ })).toHaveTextContent('Beginner · Any time frame · Coach’s choice')
  openOptions()
  expect(within(screen.getByRole('radiogroup', { name: 'Skill focus' })).getByRole('radio', { name: 'Coach’s choice' })).toHaveAttribute('aria-checked', 'true')
  expect(within(screen.getByRole('radiogroup', { name: 'Time frame' })).getByRole('radio', { name: 'Any time' })).toHaveAttribute('aria-checked', 'true')
})
it('opens the partner profile and the partner picker from the partner card', () => {
  const about = vi.fn()
  const change = vi.fn()
  render(<ConversationStart {...props} onStart={vi.fn()} onAboutPartner={about} onChangePartner={change} />)
  fireEvent.click(screen.getByRole('button', { name: 'About Nūr' }))
  fireEvent.click(screen.getByRole('button', { name: 'Change partner' }))
  expect(about).toHaveBeenCalledOnce()
  expect(change).toHaveBeenCalledOnce()
})
it('offers sending a message as the other way to begin', () => {
  render(<ConversationStart {...props} onStart={vi.fn()} />)
  expect(screen.getByText('…or send a message to begin')).toBeInTheDocument()
})
it('withholds every start while a draft or the microphone is in use', () => {
  const { rerender } = render(<ConversationStart {...props} onStart={vi.fn()} canPartnerStart={false} />)
  expect(screen.getByRole('button', { name: 'Nūr starts' })).toBeDisabled()
  expect(screen.getByRole('button', { name: /الطعام والشراب/ })).toBeDisabled()
  // Writing a topic can wait for the draft; starting with it cannot.
  fireEvent.change(screen.getByRole('textbox', { name: 'Your own topic' }), { target: { value: 'Mi calle' } })
  expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled()
  rerender(<ConversationStart {...props} onStart={vi.fn()} recording={true} />)
  expect(screen.getByRole('button', { name: 'Nūr starts' })).toBeDisabled()
  expect(screen.getByRole('textbox', { name: 'Your own topic' })).toBeDisabled()
})
it('displays failed starts without automatic retry', async () => {
  const start = vi.fn().mockRejectedValue(new Error('Conversation already started.'))
  render(<ConversationStart {...props} onStart={start} />)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Nūr starts' })))
  expect(screen.getByRole('alert')).toHaveTextContent('Conversation already started.')
  expect(start).toHaveBeenCalledOnce()
})
it('blocks duplicate starts and setting changes while one is in flight', async () => {
  const start = vi.fn(() => new Promise<void>(() => {}))
  render(<ConversationStart {...props} onStart={start} />)
  const topic = screen.getByRole('button', { name: /الطعام والشراب/ })
  fireEvent.click(topic)
  await waitFor(() => expect(topic).toBeDisabled())
  expect(within(topic).getByRole('status')).toHaveTextContent('Starting…')
  expect(screen.getByRole('button', { name: 'Nūr starts' })).toBeDisabled()
  expect(within(screen.getByRole('radiogroup', { name: 'Difficulty' })).getByRole('radio', { name: 'Fluent' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Nūr starts' }))
  expect(start).toHaveBeenCalledOnce()
})
it('deletes a saved topic from its corner control through the saved-topics action, without starting', async () => {
  saved = [{ id: 'saved-1', text: 'Mi barrio' }]
  const start = vi.fn().mockResolvedValue(undefined)
  render(<ConversationStart {...props} onStart={start} />)
  const remove = await screen.findByRole('button', { name: 'Delete Mi barrio' })
  expect(remove.closest('.saved-topic')).toContainElement(screen.getByRole('button', { name: 'Mi barrio' }))
  workspace.execute.mockImplementation(async () => { saved = []; return {} })
  await act(async () => fireEvent.click(remove))
  expect(workspace.execute).toHaveBeenCalledWith(expect.objectContaining({ revision: 4 }), { kind: 'saveTopics', additions: [], deletions: ['saved-1'], expectedRevision: 4 })
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Mi barrio' })).toBeNull())
  expect(start).not.toHaveBeenCalled()
})
it('keeps a saved topic and shows the failure when deleting it fails', async () => {
  saved = [{ id: 'saved-1', text: 'Mi barrio' }]
  render(<ConversationStart {...props} onStart={vi.fn()} />)
  const remove = await screen.findByRole('button', { name: 'Delete Mi barrio' })
  workspace.execute.mockRejectedValue(new Error('Settings changed elsewhere.'))
  await act(async () => fireEvent.click(remove))
  expect(await screen.findByText('Settings changed elsewhere.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Mi barrio' })).toBeInTheDocument()
  expect(remove).toBeEnabled()
})
