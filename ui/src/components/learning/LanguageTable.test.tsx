// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { LanguageTable, languageCode } from './LanguageTable'
import type { LanguageTotals } from '../../generated/contracts'
const row = (target: string, name: string, languageTag: string | null, xp: number, practiceAttempts: number): LanguageTotals =>
  ({ target, name, nativeName: name, languageTag, xp, conversations: 1, partnerUnderstood: 0, explorations: 0, bot: 0, revisionsSent: 0, practiceAttempts })
const rows = [row('french', 'French', 'fr', 40, 9), row('spanish', 'Spanish', 'es', 120, 2), row('mandarin', 'Mandarin', 'zh-Hans', 5, 30)]
const order = () => screen.getAllByRole('row').slice(1, -1).map(tr => within(tr).getByRole('rowheader').textContent)
it('sorts by XP first and re-sorts by any column, toggling direction', () => {
  render(<LanguageTable rows={rows} active="french" compact={false} onSelect={vi.fn()} />)
  expect(order()).toEqual(['ESSpanish', 'FRFrench', 'ZHMandarin'])
  fireEvent.click(screen.getByRole('button', { name: 'Practice' }))
  expect(order()).toEqual(['ZHMandarin', 'FRFrench', 'ESSpanish'])
  expect(screen.getByRole('columnheader', { name: 'Practice' })).toHaveAttribute('aria-sort', 'descending')
  fireEvent.click(screen.getByRole('button', { name: 'Practice' }))
  expect(order()).toEqual(['ESSpanish', 'FRFrench', 'ZHMandarin'])
  fireEvent.click(screen.getByRole('button', { name: 'Languages' }))
  expect(order()).toEqual(['FRFrench', 'ZHMandarin', 'ESSpanish'])
  expect(screen.getByRole('row', { name: /French/ })).toHaveAttribute('data-active', 'true')
})
it('adds up each row\'s effort and each column over every language', () => {
  render(<LanguageTable rows={rows} active={undefined} compact={false} onSelect={vi.fn()} />)
  const total = screen.getByRole('row', { name: /^Total/ })
  expect(total.querySelector('[data-column="xp"]')?.textContent).toBe('165')
  expect(total.querySelector('[data-column="practiceAttempts"]')?.textContent).toBe('41')
  expect(total.querySelector('[data-column="effort"]')?.textContent).toBe('41')
  expect(screen.getByRole('row', { name: /Mandarin/ }).querySelector('[data-column="effort"]')?.textContent).toBe('30')
})
it('leaves conversations out of the compact table', () => {
  render(<LanguageTable rows={rows} active={undefined} compact onSelect={vi.fn()} />)
  expect(screen.queryByRole('button', { name: 'Conversations' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Practice' })).toBeVisible()
})
it('reports the language of a pressed row or name', () => {
  const select = vi.fn()
  render(<LanguageTable rows={rows} active="french" compact={false} onSelect={select} />)
  fireEvent.click(screen.getByRole('button', { name: /Mandarin/ }))
  expect(select).toHaveBeenLastCalledWith('mandarin')
  fireEvent.click(within(screen.getByRole('row', { name: /Spanish/ })).getAllByRole('cell')[0])
  expect(select).toHaveBeenLastCalledWith('spanish')
  expect(select).toHaveBeenCalledTimes(2)
})
it('takes the code from the primary subtag of the declared tag', () => {
  expect(languageCode({ languageTag: 'zh-Hans', target: 'mandarin' })).toBe('ZH')
  expect(languageCode({ languageTag: null, target: 'klingon' })).toBe('KLINGON')
})
