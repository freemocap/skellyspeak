// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { SkillList } from './SkillList'
import { skillDemo } from '../../domain/learning/catalog/skillDemo'

it('updates the meter while preserving row order during reward presentation', () => {
  const before = structuredClone(skillDemo)
  const view = render(<SkillList snapshot={before} presenting onSelect={vi.fn()} />)
  const order = [...view.container.querySelectorAll('[data-reward-skill]')].map(node => node.getAttribute('data-reward-skill'))
  const after = structuredClone(before)
  after.profile.skills.find(skill => skill.skill_id === 'greeting')!.xp = 32
  view.rerender(<SkillList snapshot={after} presenting onSelect={vi.fn()} />)
  expect(screen.getByRole('progressbar', { name: 'Greet and say goodbye practice XP' })).toHaveAttribute('value', '32')
  expect([...view.container.querySelectorAll('[data-reward-skill]')].map(node => node.getAttribute('data-reward-skill'))).toEqual(order)
})
