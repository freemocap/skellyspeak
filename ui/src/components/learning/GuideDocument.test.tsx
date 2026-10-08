// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { GuideDocument } from './GuideDocument'
import { ReadingScopeContext } from '../reading/ReadingContext'
vi.mock('../../platform/ipc/tauri', async original => ({
  ...await original<typeof import('../../platform/ipc/tauri')>(),
  languageFor: (code: string) => ({ languageTag: code === 'arabic' ? 'ar' : 'en', direction: code === 'arabic' ? 'rtl' : 'ltr' }),
}))
const target = vi.hoisted(() => vi.fn())
vi.mock('../reading/TargetText', async original => ({
  ...await original<typeof import('../reading/TargetText')>(),
  TargetText: ({ text }: { text: string }) => { target(text); return <span>{text}</span> },
}))
it('renders lesson hierarchy and routes exact examples through shared target reading', () => {
  render(<GuideDocument text={'# Past reference\n\n## How it works\n\n### A completed event\n\nUse `fui` for this example.\n\n> Ayer fui al mercado.\n\nYesterday I went to the market.\n\n## Editorial notes\n\nSpeaker review pending.'} />)
  expect(screen.getByRole('heading', { name: 'Past reference', level: 3 })).toBeVisible()
  expect(screen.getByRole('heading', { name: 'A completed event', level: 5 })).toBeVisible()
  expect(target).toHaveBeenCalledWith('Ayer fui al mercado.')
  expect(target).toHaveBeenCalledWith('fui')
  expect(screen.getByText('Yesterday I went to the market.')).toBeVisible()
  expect(screen.getByText('Speaker review pending.').closest('details')).not.toHaveAttribute('open')
})

it.each([
  ['english', 'arabic', 'ar', 'rtl', 'استعمل', 'can'],
  ['arabic', 'english', 'en', 'ltr', 'Use', 'أستطيع'],
])('keeps %s target fragments separate from %s explanation direction', (language, explanation, tag, direction, prose, fragment) => {
  const { container } = render(<ReadingScopeContext value={{ language, variety: null, explanation, explanationVariety: null }}>
    <GuideDocument text={`${prose} \`${fragment}\`.`} />
  </ReadingScopeContext>)
  expect(container.querySelector('article')).toHaveAttribute('lang', tag)
  expect(container.querySelector('article')).toHaveAttribute('dir', direction)
  expect(container.querySelector('bdi.target-inline')).toHaveTextContent(fragment)
  expect(target).toHaveBeenCalledWith(fragment)
  expect(target).not.toHaveBeenCalledWith(prose)
})

it('uses the displayed translation language even when actions reference an English source edition', () => {
  const context = { reference: { language: 'spanish', variety: 'spanish-spain', skillId: 'time_events', editionLanguage: 'english', fingerprint: 'source' }, subskills: [], examples: [] }
  const { container } = render(<ReadingScopeContext value={{ language: 'spanish', variety: 'spanish-spain', explanation: 'arabic', explanationVariety: null }}>
    <GuideDocument text="شرح مترجم" context={context} />
  </ReadingScopeContext>)
  expect(container.querySelector('article')).toHaveAttribute('lang', 'ar')
  expect(container.querySelector('article')).toHaveAttribute('dir', 'rtl')
})
