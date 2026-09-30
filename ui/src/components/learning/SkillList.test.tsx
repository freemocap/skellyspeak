// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { SkillList } from './SkillList'
import { skillDemo } from '../../domain/learning/catalog/skillDemo'

it('updates XP while preserving row order during reward presentation', () => {
  const before = structuredClone(skillDemo)
  const view = render(<SkillList snapshot={before} presenting onSelect={vi.fn()} />)
  const order = [...view.container.querySelectorAll('[data-reward-skill]')].map(node => node.getAttribute('data-reward-skill'))
  const after = structuredClone(before)
  after.profile.skills.find(skill => skill.skill_id === 'quantity')!.xp = 32
  view.rerender(<SkillList snapshot={after} presenting onSelect={vi.fn()} />)
  expect(view.container.querySelector('[data-reward-skill="quantity"]')).toHaveTextContent('32 XP')
  expect(screen.queryByRole('progressbar')).toBeNull()
  expect([...view.container.querySelectorAll('[data-reward-skill]')].map(node => node.getAttribute('data-reward-skill'))).toEqual(order)
})
