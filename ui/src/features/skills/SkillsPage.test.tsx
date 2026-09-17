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
it('shows exactly 45 skills and eight optional category filters without branches', () => {
  render(<SkillList snapshot={skillDemo} onSelect={vi.fn()} />)
  expect(rows()).toHaveLength(45)
  expect(screen.getAllByRole('option')).toHaveLength(9)
  expect(rows()).toEqual(skillDemo.catalog.filter(n=>n.kind==='skill').map(n=>n.id))
  fireEvent.change(screen.getByRole('combobox'), {target:{value:'social'}})
  expect(rows()).toEqual(['courtesy','social_checkin','greeting'])
})
it('holds order during reward presentation and uses continuing 50 XP targets', async () => {
  const {rerender}=render(<SkillList snapshot={skillDemo} onSelect={vi.fn()} />)
  const original=rows()
  rerender(<SkillList snapshot={withXp('greeting', 105)} onSelect={vi.fn()} presenting />)
  expect(rows()).toEqual(original)
  rerender(<SkillList snapshot={withXp('greeting',105)} onSelect={vi.fn()} />)
  await waitFor(()=>expect(rows()[0]).toBe('greeting'))
  const bar=document.querySelector('[data-reward-skill="greeting"] progress')!
  expect(bar).toHaveAttribute('value','5')
  expect(bar).toHaveAttribute('max','50')
  expect(bar).toHaveAttribute('aria-valuetext','105 XP; next milestone 150')
  expect(rows().slice(1)).toEqual(original.filter(id=>id!=='greeting'))
})
it('saves focus before returning to conversation and keeps errors visible', async () => {
  const actions=handlers()
  render(<SkillListView snapshot={skillDemo} demonstration={false} {...actions} />)
  fireEvent.click(document.querySelector('[data-reward-skill="referent"]')!)
  fireEvent.click(screen.getByRole('button',{name:'Practise this in conversation'}))
  await waitFor(()=>expect(actions.onPractice).toHaveBeenCalledOnce())
  expect(actions.save).toHaveBeenCalledWith(expect.objectContaining({focus:'referent'}))
  actions.save.mockRejectedValueOnce(new Error('Profile changed'))
  fireEvent.click(screen.getByRole('button',{name:'Practise this in conversation'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('Profile changed')
  expect(actions.onPractice).toHaveBeenCalledOnce()
})
