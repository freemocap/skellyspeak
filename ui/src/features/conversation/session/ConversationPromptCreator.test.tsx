// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ConversationStartConfig, Language, PersonaDetails } from '../../../generated/contracts'
import { ConversationPromptCreator } from './ConversationPromptCreator'
const backend = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('../../../platform/ipc/native', () => backend)
vi.mock('../../../domain/input/back', () => ({ openOverlay: () => () => {} }))
const initial: ConversationStartConfig = { difficulty: 'beginner', varietyId: 'arabic-levantine', direction: { topic: null, timeReference: 'any', usePersonaDetails: true } }
const language = { varieties: [{ id: 'arabic-levantine', name: 'Levantine' }] } as Language
const persona = { name: 'Nūr' } as PersonaDetails
function mount() {
  const apply = vi.fn().mockResolvedValue(undefined)
  const close = vi.fn()
  render(<ConversationPromptCreator conversationId="chat" initial={initial} topics={[{ id: 'food', label: 'Food' }]} savedTopics={[{ id: 'saved', text: 'My hometown' }]} language={language} persona={persona} onApply={apply} onClose={close} />)
  return { apply, close }
}
beforeEach(() => {
  vi.clearAllMocks()
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  backend.invoke.mockImplementation(async (_command, args) => {
    if (args.yaml === 'invalid: [') throw new Error('Invalid configuration YAML.')
    const configuration = args.configuration ?? { ...initial, difficulty: 'fluent' }
    return { configuration, yaml: 'difficulty: beginner', systemPrompt: `${configuration.difficulty} ${configuration.direction.timeReference} conversation`, difficultyPrompts: [['beginner', 'Reviewed beginner instruction'], ['fluent', 'Reviewed fluent instruction']] }
  })
})
it('shares choices with the native preview and applies without inference', async () => {
  const { apply } = mount()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Food' }))
  fireEvent.click(screen.getByRole('button', { name: 'Past events' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Use persona details' }))
  fireEvent.click(screen.getByRole('tab', { name: 'Prompt preview' }))
  await screen.findByText('beginner past conversation')
  expect(screen.getByText('Opening request preview · no conversation history or model call')).toBeVisible()
  expect(apply).not.toHaveBeenCalled()
  expect(backend.invoke.mock.calls.every(([command]) => command === 'preview_conversation_prompt')).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
  await waitFor(() => expect(apply).toHaveBeenCalledWith({ ...initial, direction: { topic: { kind: 'builtin', id: 'food' }, timeReference: 'past', usePersonaDetails: false } }, [], []))
})
it('keeps invalid YAML visible and blocks Apply and view switching until corrected', async () => {
  mount()
  await waitFor(() => expect(screen.getByRole('tab', { name: 'YAML' })).toBeEnabled())
  fireEvent.click(screen.getByRole('tab', { name: 'YAML' }))
  fireEvent.change(screen.getByLabelText('Conversation configuration'), { target: { value: 'invalid: [' } })
  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid configuration YAML')
  expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
  expect(screen.getByRole('tab', { name: 'Form' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Conversation configuration'), { target: { value: 'difficulty: fluent' } })
  await waitFor(() => expect(screen.getByRole('tab', { name: 'Form' })).toBeEnabled())
  fireEvent.click(screen.getByRole('tab', { name: 'Form' }))
  expect(screen.getByRole('combobox', { name: 'Difficulty' })).toHaveValue('fluent')
})
it('stages custom-topic additions and deletions and discards them on Cancel', async () => {
  const { apply, close } = mount()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled())
  fireEvent.click(screen.getByText('Saved topics'))
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
  fireEvent.click(screen.getByRole('button', { name: 'Custom topic' }))
  const dialog = within(screen.getByRole('dialog', { name: 'Suggest a topic' }))
  fireEvent.change(dialog.getByRole('textbox', { name: 'Topic' }), { target: { value: 'A trip home' } })
  fireEvent.click(dialog.getByRole('checkbox', { name: 'Save for later' }))
  fireEvent.click(dialog.getByRole('button', { name: 'Use topic' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Suggest a topic' })).toBeNull())
  expect(screen.getByRole('button', { name: 'A trip home · Pending save' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(close).toHaveBeenCalledOnce()
  expect(apply).not.toHaveBeenCalled()
})
it('retains staged changes when Apply fails without retrying', async () => {
  const { apply, close } = mount()
  apply.mockRejectedValue(new Error('Settings changed.'))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled())
  fireEvent.click(screen.getByText('Saved topics'))
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Settings changed.')
  expect(close).not.toHaveBeenCalled()
  expect(apply).toHaveBeenCalledExactlyOnceWith(initial, [], ['saved'])
  expect(screen.queryByRole('button', { name: 'My hometown' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled()
  apply.mockResolvedValue(undefined)
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(apply).toHaveBeenLastCalledWith(initial, [], ['saved'])
})

it('allows retry and view switching after a save failure in valid YAML', async () => {
  const { apply, close } = mount()
  apply.mockRejectedValueOnce(new Error('Could not save.'))
  await waitFor(() => expect(screen.getByRole('tab', { name: 'YAML' })).toBeEnabled())
  fireEvent.click(screen.getByRole('tab', { name: 'YAML' }))
  fireEvent.change(screen.getByLabelText('Conversation configuration'), { target: { value: 'difficulty: fluent' } })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save.')
  expect(screen.getByRole('tab', { name: 'Form' })).toBeEnabled()
  expect(screen.getByRole('tab', { name: 'Prompt preview' })).toBeEnabled()
  expect(screen.getByLabelText('Conversation configuration')).toHaveValue('difficulty: fluent')
  expect(apply).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(apply).toHaveBeenLastCalledWith({ ...initial, difficulty: 'fluent' }, [], [])
})
