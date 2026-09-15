// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { DomainEvidenceTree } from './DomainEvidenceTree'
import { skillDemo } from '../../domain/learning/catalog/skillDemo'
import { skillIndex } from '../../domain/learning/catalog/skill-index'

it('shows uncertainty instead of an empty proficiency bar without credited observations', () => {
  render(<DomainEvidenceTree snapshot={skillDemo} onSelect={vi.fn()} />)
  expect(screen.getAllByText('Not enough evidence to estimate')).toHaveLength(6)
  expect(screen.queryByRole('meter')).toBeNull()
})
it('counts an attempt once per domain even when it credits multiple skills', () => {
  const catalog = skillIndex(skillDemo).catalog
  const domain = catalog.nodes.find(node => node.kind === 'domain')!
  const skills = catalog.nodes.filter(node => node.kind === 'skill' && catalog.domain(node.id).id === domain.id)
  const snapshot = { ...skillDemo, profile: { ...skillDemo.profile, credits: skills.slice(0, 2).map(skill => ({ attempt_id: 'one-attempt', skill_id: skill.id, xp: 2 })) } }
  const select = vi.fn()
  render(<DomainEvidenceTree snapshot={snapshot} onSelect={select} />)
  const meter = screen.getByRole('meter', { name: domain.label })
  expect(meter).toHaveAttribute('value', '1')
  fireEvent.click(screen.getByRole('button', { name: new RegExp(domain.label) }))
  expect(select).toHaveBeenCalledWith(domain.id)
})
