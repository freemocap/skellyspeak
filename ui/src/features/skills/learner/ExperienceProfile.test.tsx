// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { skillDemo } from '../../../domain/learning/catalog/skillDemo'
import type { SkillRecord } from '../../../domain/learning/evidence/skills'
import { ExperienceProfile } from './ExperienceProfile'

it('updates an open profile from published credits and switches variety without a refresh action', () => {
  const snapshot = structuredClone(skillDemo)
  const view = render(<ExperienceProfile snapshot={snapshot} initialVariety="one" onInspect={vi.fn()} />)
  const total = () => within(screen.getByRole('row', { name: /^Σ/ })).getAllByRole('cell').map(cell => cell.textContent)
  expect(total()).toEqual(['0', '0', '0'])
  const skill = snapshot.profile.skills[0]
  const record: SkillRecord = {
    attempt_id: 'a', session_id: 's', turn_id: 1, message_id: 1, replaces_message_id: null,
    chat_id: 'c', learner_id: snapshot.learner_id, target: snapshot.target, variety: 'one', native: 'english',
    source: 'A cup.', input: { modality: 'text', suggestion: false, scaffold: false, revision: false },
    at_secs: 1, model: 'fixture', provider_mode: 'fixture', catalog_version: snapshot.catalog_version,
    construct_registry_hash: snapshot.construct_registry_hash, mapping_error: null, support_step: null,
    prompt_version: 'fixture', status: 'complete', error: null,
    assessment: { judgments: [{ skill_id: skill.skill_id, presence: 'direct', quotes: [], rationale: '' }] },
  }
  snapshot.records.push(record)
  Object.assign(skill, { experience: 1, xp: 1 })
  snapshot.profile.xp = 1
  snapshot.profile.credits.push({ attempt_id: 'a', skill_id: skill.skill_id, experience: 1, effort: 0, xp: 1,
    event: { id: 'a', attemptId: 'a', constructId: skill.skill_id, kind: 'experience', tier: 1,
      experience: 1, effort: 0, xp: 1, quote: '', support: 'not_weighted', difficulty: 'not_weighted',
      novelty: 'not_weighted', policyHash: 'experience-effort-1', atSecs: 1n, claimed: true } })
  view.rerender(<ExperienceProfile snapshot={structuredClone(snapshot)} initialVariety="one" onInspect={vi.fn()} />)
  expect(total()).toEqual(['1', '0', '1'])
  view.rerender(<ExperienceProfile snapshot={snapshot} initialVariety="two" onInspect={vi.fn()} />)
  expect(total()).toEqual(['0', '0', '0'])
  expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument()
})
