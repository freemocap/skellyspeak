// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { SkillGuide } from './SkillGuide'
import { skillDemo } from '../../domain/learning/catalog/skillDemo'
import { getSkillGuide } from '../../platform/ipc/skill-evidence'
vi.mock('../../platform/ipc/skill-evidence', () => ({ getSkillGuide: vi.fn() }))
it('shows the standalone guide without a disclosure and offers only valid varieties', async () => {
  const request = vi.mocked(getSkillGuide)
  request.mockReset().mockResolvedValue({ markdown: 'Visible guide.', generated: false, explanationLanguage: 'english', provenance: {} })
  const snapshot = { ...skillDemo, guide_explanation_language: 'english', guides: [
    { id: 'one', name: 'One', skills: { quantity: null } },
    { id: 'two', name: 'Two', skills: { quantity: null } },
  ] }
  const view = render(<SkillGuide initiallyOpen={false} collapsible={false} snapshot={snapshot} skillId="quantity" active="one" />)
  expect(await screen.findByText('Visible guide.')).toBeVisible()
  expect(view.container.querySelector('details.practice-skill')).toBeNull()
  expect(screen.queryByText('Skill guide')).not.toBeInTheDocument()
  expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['One', 'Two'])
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } })
  expect(screen.getByRole('combobox')).toHaveValue('one')
  expect(request).toHaveBeenCalledExactlyOnceWith(snapshot.target, 'one', 'quantity', 'english', false)
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'two' } })
  await waitFor(() => expect(request).toHaveBeenLastCalledWith(snapshot.target, 'two', 'quantity', 'english', false))
})

it('keeps an unknown variety as a disabled prompt without requesting an invalid guide', () => {
  const request = vi.mocked(getSkillGuide)
  request.mockReset()
  const snapshot = { ...skillDemo, guide_explanation_language: 'english', guides: [{ id: 'one', name: 'One', skills: { quantity: null } }] }
  render(<SkillGuide initiallyOpen collapsible={false} snapshot={snapshot} skillId="quantity" active="unknown" />)
  expect(screen.getByText('Choose a variety')).toBeDisabled()
  expect(screen.getByRole('combobox')).toHaveValue('')
  expect(request).not.toHaveBeenCalled()
})

it('opens authored Markdown for an explicit variety and never substitutes a missing guide', () => {
  const snapshot = { ...skillDemo, guides: [
    { id: 'one', name: 'One', skills: { quantity: '## Shared language guidance\n\nAuthored quantity guidance.' } },
    { id: 'two', name: 'Two', skills: { quantity: null } },
  ] }
  render(<SkillGuide initiallyOpen={false} snapshot={snapshot} skillId="quantity" />)
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
  const view = render(<SkillGuide initiallyOpen={false} snapshot={snapshot} skillId="quantity" active="one" />)
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
  const view = render(<SkillGuide initiallyOpen={false} snapshot={snapshot} skillId="quantity" active="one" />)
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
  const view = render(<SkillGuide initiallyOpen={false} snapshot={snapshot} skillId="quantity" active="one" />)
  fireEvent.click(screen.getByText('Skill guide'))
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'two' } })
  view.rerender(<SkillGuide initiallyOpen={false} snapshot={snapshot} skillId="quantity" active="two" />)
  view.rerender(<SkillGuide initiallyOpen={false} snapshot={snapshot} skillId="quantity" active="one" />)
  expect(screen.getByText('First guide.')).toBeInTheDocument()
  view.rerender(<SkillGuide initiallyOpen={false} snapshot={{ ...snapshot, target: 'another', guides: [] }} skillId="quantity" />)
  expect(screen.queryByText('First guide.')).not.toBeInTheDocument()
})
