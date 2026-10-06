// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { SkillOverview } from './SkillOverview'
import { skillDemo } from '../../../domain/learning/catalog/skillDemo'

it('does not carry language-wide levels into a variety-filtered summary', () => {
  const snapshot = structuredClone(skillDemo)
  const node = snapshot.catalog.find(item => item.id === 'possibilities_constraints')!
  snapshot.profile.levels!.skills.find(item => item.skillId === node.id)!.level = 4
  const view = render(<SkillOverview languageName="Spanish" snapshot={snapshot} node={node}>{null}</SkillOverview>)
  expect(screen.getByText(/Skill level 4/)).toBeVisible()
  view.rerender(<SkillOverview languageName="Spanish" snapshot={snapshot} node={node} variety="unpractised-variety">{null}</SkillOverview>)
  expect(screen.queryByText(/Skill level 4/)).toBeNull()
  expect(screen.getByText('0 XP')).toBeVisible()
})
