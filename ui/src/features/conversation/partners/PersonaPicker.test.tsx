// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { PersonaPicker, type PersonaChoice } from './PersonaPicker'
import { personaName } from './personaLimits'

const choices: PersonaChoice[] = [
  { id: 'lin', name: personaName({ name: '小林', romanizedName: 'Xiǎo Lín' }), symbol: '🚲' },
  { id: 'mei', name: personaName({ name: '美', romanizedName: 'Měi' }), symbol: undefined },
]

function renderPicker(currentId = 'lin') {
  const handlers = { onSelect: vi.fn(), onEdit: vi.fn(), onCreate: vi.fn() }
  render(<PersonaPicker choices={choices} currentId={currentId} busy={false} {...handlers} />)
  return handlers
}

it('names a persona with its romanized name beside it', () => {
  expect(personaName({ name: '小林', romanizedName: 'Xiǎo Lín' })).toBe('小林 (Xiǎo Lín)')
  expect(personaName({ name: 'Lucía', romanizedName: null })).toBe('Lucía')
})

it('shows the current contact with its first vibe emoji as the avatar', () => {
  renderPicker()
  const toggle = screen.getByRole('button', { name: /小林 \(Xiǎo Lín\)/ })
  expect(toggle).toHaveTextContent('🚲')
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
})

it('switches to another contact from the menu', () => {
  const { onSelect } = renderPicker()
  fireEvent.click(screen.getByRole('button', { name: /小林/ }))
  fireEvent.click(screen.getByRole('menuitemradio', { name: /美 \(Měi\)/ }))
  expect(onSelect).toHaveBeenCalledExactlyOnceWith('mei')
  expect(screen.queryByRole('menu')).toBeNull()
})

it('choosing the current contact again does nothing', () => {
  const { onSelect } = renderPicker()
  fireEvent.click(screen.getByRole('button', { name: /小林/ }))
  fireEvent.click(screen.getByRole('menuitemradio', { name: /小林/ }))
  expect(onSelect).not.toHaveBeenCalled()
})

it('opens the new persona dialog and the editor from the menu', () => {
  const { onCreate, onEdit } = renderPicker()
  fireEvent.click(screen.getByRole('button', { name: /小林/ }))
  fireEvent.click(screen.getByRole('menuitem', { name: '+ New persona…' }))
  expect(onCreate).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: /小林/ }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Edit persona' }))
  expect(onEdit).toHaveBeenCalledOnce()
})

it('a contact without a vibe emoji shows an empty avatar', () => {
  renderPicker('mei')
  const toggle = screen.getByRole('button', { name: /美 \(Měi\)/ })
  expect(toggle.querySelector('.persona-avatar')).toHaveTextContent('')
})
