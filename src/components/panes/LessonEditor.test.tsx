// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LessonEditor } from './LessonEditor'
import type { LessonChoices, LessonState } from '../../types'
vi.mock('../../lib/back', () => ({ openOverlay: () => () => {} }))
const initial: LessonState = { revision: 0, choices: { goal: '', preferences: [], correction_budget: null }, changes: [] }
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function (): void { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function (): void { this.removeAttribute('open') }
})
it('autosaves and flushes the latest edit on backdrop dismissal using the saved revision', async () => {
  const save = vi.fn(async (choices: LessonChoices, revision: number) => ({ lesson: { ...initial, choices, revision: revision + 1 } }))
  const close = vi.fn()
  render(<LessonEditor lesson={initial} onSave={save} onClose={close} />)
  fireEvent.change(screen.getByLabelText('Your learning goal'), { target: { value: 'Travel' } })
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
  fireEvent.change(screen.getByLabelText('Your learning goal'), { target: { value: 'Travel stories' } })
  fireEvent.click(screen.getByRole('dialog'), { clientX: -10, clientY: -10 })
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(save).toHaveBeenLastCalledWith({ ...initial.choices, goal: 'Travel stories' }, 1)
})
it('keeps edits made during a save and waits for both saves before closing', async () => {
  let finish: ((value: { lesson: LessonState }) => void) | undefined
  const save = vi.fn()
    .mockImplementationOnce(() => new Promise<{ lesson: LessonState }>((resolve) => { finish = resolve }))
    .mockImplementation(async (choices: LessonChoices, revision: number) => ({ lesson: { ...initial, choices, revision: revision + 1 } }))
  const close = vi.fn()
  render(<LessonEditor lesson={initial} onSave={save} onClose={close} />)
  fireEvent.change(screen.getByLabelText('Your learning goal'), { target: { value: 'Travel' } })
  await waitFor(() => expect(save).toHaveBeenCalledOnce())
  fireEvent.change(screen.getByLabelText('Your learning goal'), { target: { value: 'Stories' } })
  fireEvent.click(screen.getByRole('button', { name: 'Done' }))
  expect(close).not.toHaveBeenCalled()
  await act(async () => { finish!({ lesson: { ...initial, revision: 1, choices: { ...initial.choices, goal: 'Travel' } } }) })
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(save).toHaveBeenLastCalledWith({ ...initial.choices, goal: 'Stories' }, 1)
})
