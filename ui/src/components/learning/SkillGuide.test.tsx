// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { SkillGuide } from './SkillGuide'
import { skillDemo } from '../../domain/learning/catalog/skillDemo'
import { getSkillGuide } from '../../platform/ipc/skill-evidence'
vi.mock('../../platform/ipc/skill-evidence', () => ({ getSkillGuide: vi.fn() }))
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

it('translates only on opening, exposes failures and retries explicitly', async () => {
  const request = vi.mocked(getSkillGuide)
  request.mockReset().mockRejectedValueOnce(new Error('Translation failed')).mockResolvedValue({ markdown: 'Translated guide.', generated: true, explanationLanguage: 'arabic', provenance: { origin: 'ai' } })
  const snapshot = { ...skillDemo, guide_explanation_language: 'arabic', guides: [{ id: 'one', name: 'One', skills: { quantity: null } }] }
  const view = render(<SkillGuide snapshot={snapshot} skillId="quantity" active="one" />)
  expect(request).not.toHaveBeenCalled()
  const details = view.container.querySelector('details')!
  await act(async () => { details.open = true; fireEvent(details, new Event('toggle')) })
  await screen.findByText('Translation failed')
  expect(request).toHaveBeenCalledExactlyOnceWith(snapshot.target, 'one', 'quantity', 'arabic', false)
  fireEvent.click(screen.getByText('Retry'))
  await screen.findByText('Translated guide.')
  expect(request).toHaveBeenLastCalledWith(snapshot.target, 'one', 'quantity', 'arabic', true)
  expect(screen.getByText('AI-generated translation')).toBeVisible()
  await act(async () => { details.open = false; fireEvent(details, new Event('toggle')); details.open = true; fireEvent(details, new Event('toggle')) })
  expect(request).toHaveBeenCalledTimes(2)
})

it('does not publish a late translation into another variety', async () => {
  let finish!: (value: Awaited<ReturnType<typeof getSkillGuide>>) => void
  const request = vi.mocked(getSkillGuide)
  request.mockReset().mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValue({ markdown: 'Second variety.', generated: true, explanationLanguage: 'arabic', provenance: {} })
  const snapshot = { ...skillDemo, guide_explanation_language: 'arabic', guides: [{ id: 'one', name: 'One', skills: { quantity: null } }, { id: 'two', name: 'Two', skills: { quantity: null } }] }
  const view = render(<SkillGuide snapshot={snapshot} skillId="quantity" active="one" />)
  await act(async () => { const details = view.container.querySelector('details')!; details.open = true; fireEvent(details, new Event('toggle')) })
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1))
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'two' } })
  await screen.findByText('Second variety.')
  await act(async () => finish({ markdown: 'First variety.', generated: true, explanationLanguage: 'arabic', provenance: {} }))
  expect(screen.queryByText('First variety.')).not.toBeInTheDocument()
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
