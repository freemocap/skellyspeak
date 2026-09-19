// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../components/localization/i18n'
import { LOCALES, t } from '../../domain/localization'
import { skillDemo } from '../../domain/learning/catalog/skillDemo'
import { SkillList } from '../../components/learning/SkillList'
import { SkillOverview } from './overview/SkillOverview'
import { SkillEvidenceRecord } from './evidence/SkillEvidenceRecord'
import type { SkillRecord } from '../../domain/learning/evidence/skills'

it.each(Object.keys(LOCALES))('renders translated categories, skill labels and criteria in %s', locale => {
  const node = skillDemo.catalog.find(item => item.id === 'referent')!
  render(<I18nProvider locale={locale}><SkillList snapshot={skillDemo} onSelect={vi.fn()} /><SkillOverview node={node} snapshot={skillDemo} /></I18nProvider>)
  expect(screen.getByRole('heading', { name: t(locale, node.label) })).toBeVisible()
  expect(screen.getByText(t(locale, node.criterion))).toBeVisible()
  expect(screen.getByRole('option', { name: t(locale, 'Entities & reference') })).toHaveValue('reference')
  expect(screen.getAllByRole('progressbar').length).toBe(45)
})
it('switches labels and number formatting without resetting selection or changing evidence', () => {
  const snapshot = structuredClone(skillDemo)
  snapshot.profile.skills.find(item => item.skill_id === 'greeting')!.xp = 1234
  const original = structuredClone(snapshot)
  const select = vi.fn()
  const view = render(<I18nProvider locale="german"><SkillList snapshot={snapshot} selected="greeting" onSelect={select} /></I18nProvider>)
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'social' } })
  expect(screen.getByText('1.234 XP')).toBeVisible()
  expect(screen.getByText('Begrüßen und verabschieden')).toBeVisible()
  view.rerender(<I18nProvider locale="arabic"><SkillList snapshot={snapshot} selected="greeting" onSelect={select} /></I18nProvider>)
  expect(screen.getByRole('combobox')).toHaveValue('social')
  expect(screen.getByText('التحية والوداع')).toBeVisible()
  const row = document.querySelector('[data-reward-skill="greeting"]')!
  expect(row).toHaveAttribute('aria-pressed', 'true')
  expect(row.querySelector('progress')).toHaveAttribute('value', '34')
  expect(row.querySelector('progress')!.getAttribute('aria-valuetext')).toContain(new Intl.NumberFormat('ar').format(1234))
  fireEvent.click(row)
  expect(select).toHaveBeenCalledWith('greeting')
  expect(snapshot).toEqual(original)
})
it('translates assessment and assistance labels while preserving source quotations and rationale', () => {
  const snapshot = structuredClone(skillDemo)
  const record: SkillRecord = { attempt_id: 'a', session_id: 's', turn_id: 1, message_id: 1, replaces_message_id: null, construct_registry_hash: snapshot.construct_registry_hash, mapping_error: null, support_step: null, chat_id: 'c', learner_id: snapshot.learner_id, target: snapshot.target, native: 'english', source: 'Ese café', input: { modality: 'text', suggestion: true, scaffold: false, revision: false }, at_secs: 100, model: 'fixture', provider_mode: 'custom', catalog_version: snapshot.catalog_version, prompt_version: 'fixture', status: 'complete', assessment: { judgments: [{ skill_id: 'referent', outcome: 'partial', quotes: ['Ese café'], rationale: 'Original assessment text.' }] }, error: null }
  snapshot.records = [record]
  render(<I18nProvider locale="german"><SkillEvidenceRecord record={record} judgment={record.assessment!.judgments[0]} snapshot={snapshot}>{null}</SkillEvidenceRecord></I18nProvider>)
  expect(screen.getByText('Teilweise')).toBeVisible()
  expect(screen.getByText(/Vorgeschlagene Formulierung/)).toBeVisible()
  expect(screen.getByText('Original assessment text.')).toBeVisible()
  expect(screen.getAllByText('Ese café').length).toBeGreaterThan(0)
})
