// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, expect, it, vi } from 'vitest'
import { SkillListView } from './SkillsPage'
import { SkillList } from '../../components/learning/SkillList'
import { skillDemo } from '../../domain/learning/catalog/skillDemo'
import type { SkillSnapshot } from '../../domain/learning/evidence/skills'
beforeAll(() => { HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }; HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') } })
const handlers = () => ({ refresh: vi.fn(), save: vi.fn().mockResolvedValue(undefined), saving: false, onPractice: vi.fn() })
const rows = () => [...document.querySelectorAll('[data-reward-skill]')].map(n => n.getAttribute('data-reward-skill'))
function withXp(id: string, xp: number): SkillSnapshot { return {...skillDemo, profile:{...skillDemo.profile, skills:skillDemo.profile.skills.map(s=>s.skill_id===id?{...s,xp}:s)}} }
it('shows exactly 12 skills and four optional category filters without branches', () => {
  render(<SkillList snapshot={skillDemo} onSelect={vi.fn()} />)
  expect(rows()).toHaveLength(12)
  expect(screen.getAllByRole('option')).toHaveLength(5)
  expect(rows()).toEqual(skillDemo.catalog.filter(n=>n.kind==='skill').map(n=>n.id))
  fireEvent.change(screen.getByRole('combobox'), {target:{value:'people_things'}})
  expect(rows()).toEqual(['identify_describe','possession_relationships','quantity'])
})
it('holds order during reward presentation and shows XP without milestone bars', async () => {
  const {rerender}=render(<SkillList snapshot={skillDemo} onSelect={vi.fn()} />)
  const original=rows()
  rerender(<SkillList snapshot={withXp('quantity', 105)} onSelect={vi.fn()} presenting />)
  expect(rows()).toEqual(original)
  rerender(<SkillList snapshot={withXp('quantity',105)} onSelect={vi.fn()} />)
  await waitFor(()=>expect(rows()[0]).toBe('quantity'))
  expect(document.querySelector('[data-reward-skill="quantity"] progress')).toBeNull()
  expect(document.querySelector('[data-reward-skill="quantity"]')).toHaveTextContent('105 XP')
  expect(rows().slice(1)).toEqual(original.filter(id=>id!=='quantity'))
})
it('saves focus before returning to conversation and keeps errors visible', async () => {
  const actions=handlers()
  render(<SkillListView snapshot={skillDemo} demonstration={false} {...actions} />)
  fireEvent.click(document.querySelector('[data-reward-skill="identify_describe"]')!)
  fireEvent.click(screen.getByRole('button',{name:'See the evidence'}))
  fireEvent.click(screen.getByRole('button',{name:'Use this in a conversation'}))
  await waitFor(()=>expect(actions.onPractice).toHaveBeenCalledOnce())
  expect(actions.save).toHaveBeenCalledWith(expect.objectContaining({focus:'identify_describe'}))
  actions.save.mockRejectedValueOnce(new Error('Profile changed'))
  fireEvent.click(screen.getByRole('button',{name:'Use this in a conversation'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('Profile changed')
  expect(actions.onPractice).toHaveBeenCalledOnce()
})
