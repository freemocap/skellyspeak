// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { DifficultySelect } from './DifficultySelect'

it('reuses the language select and makes no request on render/focus/reopen', () => {
  const change = vi.fn().mockResolvedValue(undefined)
  const view = render(<DifficultySelect value="beginner" saving={false} onChange={change} />)
  const select = screen.getByRole('combobox', { name: 'Difficulty' })
  expect(select).toHaveClass('chat-language-picker')
  expect(screen.getAllByRole('option')).toHaveLength(5)
  fireEvent.focus(select); fireEvent.mouseOver(select)
  view.rerender(<DifficultySelect value="fluent" saving={false} onChange={change} />)
  expect(change).not.toHaveBeenCalled()
  expect(screen.queryByRole('slider')).toBeNull()
})
it('saves one deliberate selection and disables while saving', async () => {
  const change = vi.fn().mockResolvedValue(undefined)
  const view = render(<DifficultySelect value="beginner" saving={false} onChange={change} />)
  await userEvent.setup().selectOptions(screen.getByRole('combobox'), 'absolute_zero')
  expect(change).toHaveBeenCalledExactlyOnceWith('absolute_zero')
  view.rerender(<DifficultySelect value="absolute_zero" saving onChange={change} />)
  expect(screen.getByRole('combobox')).toBeDisabled()
  expect(screen.getByRole('combobox')).toHaveAttribute('aria-busy', 'true')
})
