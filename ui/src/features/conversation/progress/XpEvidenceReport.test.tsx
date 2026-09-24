// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { skillDemo } from '../../../domain/learning/catalog/skillDemo'
import { unreportedInput, type SkillRecord } from '../../../domain/learning/evidence/skills'
import { SkillEvidenceContext } from '../../../state/learning/useSkillEvidence'
import { PracticeContext } from '../session/PracticeContext'
import { RewardInspectionContext } from './RewardInspectionContext'
import { MessageXpButton } from './MessageXpButton'
import { ConversationProgress } from './ConversationProgress'
import { xpReportCredits } from './XpEvidenceReport'

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
})
function fixture() {
  const snapshot = structuredClone(skillDemo)
  const record: SkillRecord = {
    attempt_id: 'a', session_id: 's', turn_id: 99, message_id: 1, replaces_message_id: null,
    construct_registry_hash: snapshot.construct_registry_hash, mapping_error: null, support_step: null,
    chat_id: 'chat', learner_id: snapshot.learner_id, target: snapshot.target, native: 'english',
    source: 'Esa taza.', input: unreportedInput(), at_secs: 100, model: 'test', provider_mode: 'custom',
    catalog_version: snapshot.catalog_version, prompt_version: 'test', status: 'complete', error: null,
    assessment: { judgments: [{ skill_id: 'referent', outcome: 'demonstrated', quotes: ['Esa', 'taza'], rationale: 'Identifies the cup.' }] },
  }
  snapshot.records = [record, { ...record, attempt_id: 'other', chat_id: 'other', source: 'Otra taza.' }]
  snapshot.profile.credits = snapshot.records.map(record => ({ attempt_id: record.attempt_id, skill_id: 'referent', xp: 10 }))
  snapshot.profile.skills.find(skill => skill.skill_id === 'referent')!.xp = 20
  snapshot.profile.xp = 20
  return snapshot
}

it('opens message evidence with effects off, counts multiple quotes once, and isolates the chat and source', () => {
  const snapshot = fixture()
  render(<SkillEvidenceContext value={{ snapshot, error: null }}><PracticeContext value={{ chatId: 'chat', selected: null, selectionVersion: 0, select: vi.fn() }}><RewardInspectionContext value={{ enabled: false, arrive: vi.fn() }}><MessageXpButton messageId={1} source="Esa taza." /></RewardInspectionContext></PracticeContext></SkillEvidenceContext>)
  expect(screen.getByRole('button', { name: 'Message XP' })).toHaveTextContent('10 XP')
  fireEvent.click(screen.getByRole('button', { name: 'Message XP' }))
  const report = screen.getByRole('dialog', { name: 'Message XP' })
  expect(within(report).getByText('Esa taza.')).toBeVisible()
  expect(within(report).getByText('Identifies the cup.')).toBeVisible()
  expect(within(report).queryByText('Otra taza.')).toBeNull()
  expect(xpReportCredits(snapshot, undefined, { chatId: 'chat', messageId: 1, source: 'edited' })).toEqual([])
})

it('reports whole-message evidence and excludes invalidated or uncredited attempts', () => {
  const snapshot = fixture()
  snapshot.records[0].assessment!.judgments[0].evidence_kind = 'whole_message'
  snapshot.records[0].assessment!.judgments[0].quotes = []
  expect(xpReportCredits(snapshot, 'referent')).toHaveLength(2)
  snapshot.profile.choices.excluded_attempts = ['a']
  snapshot.records[1].status = 'superseded'
  expect(xpReportCredits(snapshot, 'referent')).toEqual([])
})

it('puts the skill list inside the scroll region and opens only that conversation’s examples', () => {
  const snapshot = fixture()
  const view = render(<SkillEvidenceContext value={{ snapshot, error: null }}><PracticeContext value={{ chatId: 'chat', selected: null, selectionVersion: 0, select: vi.fn() }}><ConversationProgress chatId="chat" /></PracticeContext></SkillEvidenceContext>)
  const bar = screen.getByRole('progressbar', { name: 'Identify a referent practice XP' })
  expect(bar.closest('.analysis-scroll')).toBe(view.container.querySelector('.conversation-evidence'))
  fireEvent.click(bar)
  const report = screen.getByRole('dialog', { name: 'Identify a referent' })
  expect(within(report).getByText('Esa taza.')).toBeVisible()
  expect(within(report).queryByText('Otra taza.')).toBeNull()
  fireEvent.click(within(report).getByRole('button', { name: 'Close Identify a referent' }))
  fireEvent.click(screen.getByRole('progressbar', { name: 'Greet and say goodbye practice XP' }))
  expect(within(screen.getByRole('dialog', { name: 'Greet and say goodbye' })).getByText('No credited messages.')).toBeVisible()
})
