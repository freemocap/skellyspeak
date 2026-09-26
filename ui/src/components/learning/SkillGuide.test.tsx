// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { SkillGuide } from './SkillGuide'
import { skillDemo } from '../../domain/learning/catalog/skillDemo'
it('opens authored Markdown for an explicit variety and never substitutes a missing guide', () => {
  const snapshot = { ...skillDemo, guides: [
    { id: 'one', name: 'One', skills: { quantity: '## Shared language guidance\n\nAuthored quantity guidance.' } },
    { id: 'two', name: 'Two', skills: { quantity: null } },
  ] }
  render(<SkillGuide snapshot={snapshot} skillId="quantity" />)
  fireEvent.click(screen.getByText('Skill guide'))
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'one' } })
  expect(screen.getByText('Authored quantity guidance.')).toBeInTheDocument()
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'two' } })
  expect(screen.queryByText('Authored quantity guidance.')).not.toBeInTheDocument()
  expect(screen.getByText('No authored guide is available for this selection.')).toBeInTheDocument()
})

it('drops a manual guide selection when the inspected variety or language changes', () => {
  const snapshot = { ...skillDemo, guides: [
    { id: 'one', name: 'One', skills: { quantity: 'First guide.' } },
    { id: 'two', name: 'Two', skills: { quantity: 'Second guide.' } },
  ] }
  const view = render(<SkillGuide snapshot={snapshot} skillId="quantity" active="one" />)
  fireEvent.click(screen.getByText('Skill guide'))
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'two' } })
  view.rerender(<SkillGuide snapshot={snapshot} skillId="quantity" active="two" />)
  view.rerender(<SkillGuide snapshot={snapshot} skillId="quantity" active="one" />)
  expect(screen.getByText('First guide.')).toBeInTheDocument()
  view.rerender(<SkillGuide snapshot={{ ...snapshot, target: 'another', guides: [] }} skillId="quantity" />)
  expect(screen.queryByText('First guide.')).not.toBeInTheDocument()
})
