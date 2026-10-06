// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, expect, it, vi } from 'vitest'
import { SkillListView } from './SkillsPage'
import { SkillList } from '../../components/learning/SkillList'
import { skillDemo } from '../../domain/learning/catalog/skillDemo'
import type { SkillSnapshot } from '../../domain/learning/evidence/skills'
import { useNavigationStore } from '../../state/navigation/navigation'
import { useSkillNavigationStore } from '../../state/navigation/skill-navigation'
vi.mock('../../platform/ipc/effort', () => ({ getEffortReport: vi.fn(async (target: string) => ({ target, activity: [], entries: [], next: null })) }))
beforeAll(() => { HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }; HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') } })
const handlers = () => ({ refresh: vi.fn(), save: vi.fn().mockResolvedValue(undefined), saving: false, onPractice: vi.fn(), onExplain: vi.fn() })
const rows = () => [...document.querySelectorAll('[data-reward-skill]')].map(n => n.getAttribute('data-reward-skill'))
function withXp(id: string, xp: number): SkillSnapshot { return {...skillDemo, profile:{...skillDemo.profile, skills:skillDemo.profile.skills.map(s=>s.skill_id===id?{...s,xp}:s)}} }
it('shows eight main skills with matching optional filters', () => {
  render(<SkillList snapshot={skillDemo} onSelect={vi.fn()} />)
  expect(rows()).toHaveLength(8)
  expect(screen.getAllByRole('option')).toHaveLength(9)
  expect(rows()).toEqual(skillDemo.catalog.filter(n=>n.kind==='skill').map(n=>n.id))
  fireEvent.change(screen.getByRole('combobox'), {target:{value:'people_places'}})
  expect(rows()).toEqual(['people_places'])
})
it('holds order during reward presentation and shows XP without milestone bars', async () => {
  const {rerender}=render(<SkillList snapshot={skillDemo} onSelect={vi.fn()} />)
  const original=rows()
  rerender(<SkillList snapshot={withXp('possibilities_constraints', 105)} onSelect={vi.fn()} presenting />)
  expect(rows()).toEqual(original)
  rerender(<SkillList snapshot={withXp('possibilities_constraints',105)} onSelect={vi.fn()} />)
  await waitFor(()=>expect(rows()[0]).toBe('possibilities_constraints'))
  expect(document.querySelector('[data-reward-skill="possibilities_constraints"] progress')).toBeNull()
  expect(document.querySelector('[data-reward-skill="possibilities_constraints"]')).toHaveTextContent('105 XP')
  expect(rows().slice(1)).toEqual(original.filter(id=>id!=='possibilities_constraints'))
})
it('starts the inspected skill with its language and variety and keeps admission errors visible', async () => {
  const actions=handlers()
  actions.onPractice.mockRejectedValueOnce(new Error('Conversation changed')).mockResolvedValueOnce(undefined)
  render(<SkillListView languageName="Spanish" snapshot={skillDemo} initialVariety="unpractised-variety" demonstration={false} {...actions} />)
  fireEvent.click(document.querySelector('[data-reward-skill="people_places"]')!)
  fireEvent.click(screen.getByRole('button',{name:'People, things, and places in Spanish'}))
  fireEvent.click(screen.getByRole('button',{name:'Use this in a Spanish conversation'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('Conversation changed')
  expect(actions.save).not.toHaveBeenCalled()
  expect(actions.onPractice).toHaveBeenCalledWith(skillDemo.target, 'unpractised-variety', 'people_places')
  fireEvent.click(screen.getByRole('button',{name:'Use this in a Spanish conversation'}))
  await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull())
})

it('opens a skill as its own page with the guide expanded and returns to the overview', () => {
  useNavigationStore.setState(useNavigationStore.getInitialState())
  render(<SkillListView languageName="Spanish" snapshot={skillDemo} initialVariety="unpractised-variety" demonstration {...handlers()} />)
  expect(screen.getByRole('heading', { level: 1, name: 'Spanish progress' })).toBeVisible()
  expect(screen.getByRole('tab', { name: 'Skills' })).toHaveAttribute('aria-selected', 'true')
  fireEvent.click(document.querySelector('[data-reward-skill="people_places"]')!)
  fireEvent.click(screen.getByRole('button',{name:'People, things, and places in Spanish'}))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByRole('region', { name: 'People, things, and places' })).toBeVisible()
  expect(screen.getByText('Skill guide').closest('details')).toHaveAttribute('open')
  expect(screen.queryByRole('heading', { level: 1, name: 'Spanish progress' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /All Spanish skills/ }))
  expect(screen.getByRole('heading', { level: 1, name: 'Spanish progress' })).toBeVisible()
})

it('shows XP and Effort as tabs of the same page, and opens a requested skill', async () => {
  useNavigationStore.setState(useNavigationStore.getInitialState())
  render(<SkillListView languageName="Spanish" snapshot={skillDemo} initialVariety="unpractised-variety" demonstration {...handlers()} />)
  fireEvent.click(screen.getByRole('tab', { name: 'XP' }))
  expect(useNavigationStore.getState().progressTab).toBe('xp')
  expect(screen.getAllByRole('heading', { level: 2 }).map(heading => heading.firstChild?.textContent)).toEqual(['All languages', 'Spanish XP'])
  expect(screen.getByRole('heading', { level: 3, name: 'By skill' })).toBeVisible()
  expect(screen.getByRole('heading', { level: 3, name: 'XP history' })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'How skills work' })).toBeNull()
  fireEvent.click(screen.getByRole('tab', { name: 'Effort' }))
  expect(screen.getByRole('heading', { level: 2, name: /^Spanish effort/ })).toBeVisible()
  expect(await screen.findByText('A message you edited and sent again with different wording.')).toBeInTheDocument()
  act(() => useSkillNavigationStore.getState().explore({ target: skillDemo.target, skillId: 'people_places' }))
  expect(await screen.findByRole('region', { name: 'People, things, and places' })).toBeVisible()
})
