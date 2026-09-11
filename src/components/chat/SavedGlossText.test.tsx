// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import type { WordGlossView } from '../../contracts'
import { ReadingPreferencesContext } from '../ReadingPreferences'
import { SavedGlossText } from './SavedGlossText'
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
const text = '  sí, sí!\ne\u0301 👩🏽‍💻 مرحبا  '
const result: WordGlossView = {
  sourceMessageId: 'message', targetLanguageId: 'spanish', explanationLanguageId: 'english',
  formatVersion: 'format', templateVersion: 'template', boundaryPolicy: 'policy',
  operationId: 'operation', attemptId: 'attempt', coverage: 'partial',
  segments: [{ start: 2, end: 4, kind: 'gloss', gloss: 'yes' }, { start: 6, end: 8, kind: 'gloss', gloss: 'indeed' }, { start: 10, end: 12, kind: 'gloss', gloss: 'accent' }, { start: 13, end: 20, kind: 'gloss', gloss: 'developer' }, { start: 21, end: 26, kind: 'gloss', gloss: 'hello' }],
}
it('keeps exact source and occurrence anchors, including uncovered graphemes and whitespace', () => {
  const view = render(<SavedGlossText text={text} result={result} />)
  expect(view.container.textContent).toBe(text)
  expect([...view.container.querySelectorAll('[data-source-start]')].map(node => [node.getAttribute('data-source-start'), node.getAttribute('data-source-end'), node.textContent])).toEqual([['2', '4', 'sí'], ['6', '8', 'sí'], ['10', '12', 'e\u0301'], ['13', '20', '👩🏽‍💻'], ['21', '26', 'مرحبا']])
  fireEvent.click(screen.getAllByRole('button', { name: 'sí' })[1])
  expect(screen.getByText('indeed')).toBeVisible()
  expect(screen.queryByText('yes')).toBeNull()
  fireEvent.keyDown(screen.getAllByRole('button', { name: 'sí' })[1], { key: ' ' })
  expect(view.container.textContent).toBe(text)
  view.rerender(<SavedGlossText text={text} result={{ ...result }} />)
  view.unmount()
  render(<SavedGlossText text={text} result={result} />)
  expect(invoke).not.toHaveBeenCalled()
})
it('does not make literal or unresolved spans interactive', () => {
  const view = render(<SavedGlossText text="Hello?" result={{ ...result, segments: [{start: 0, end: 5, kind: 'unresolved', gloss: null}, {start: 5, end: 6, kind: 'literal', gloss: null}] }} />)
  expect(view.container.textContent).toBe('Hello?')
  expect(screen.queryByRole('button')).toBeNull()
  expect(invoke).not.toHaveBeenCalled()
})

it('shows saved romanization when its reading preference is enabled', () => {
  const reading: WordGlossView = { ...result, segments: [{ start: 0, end: 1, kind: 'gloss', gloss: 'you', romanization: 'nǐ' }] }
  render(<ReadingPreferencesContext value={{ autoTranslate: false, alwaysPronunciation: false, alwaysRomanize: true }}><SavedGlossText text="你" result={reading} /></ReadingPreferencesContext>)
  expect(screen.getByText('nǐ')).toBeVisible()
  expect(invoke).not.toHaveBeenCalled()
})


it('shows token translations from reading preferences without an inspection click', () => {
  render(<ReadingPreferencesContext value={{ autoTranslate: true, alwaysRomanize: false, alwaysPronunciation: false }}><SavedGlossText text={text} result={result} /></ReadingPreferencesContext>)
  expect(screen.getByText('yes')).toBeVisible()
  expect(screen.getByText('indeed')).toBeVisible()
})


it('click reveals inline values and never pins the floating hover helper', () => {
  const view = render(<SavedGlossText text={text} result={result} />)
  const word = screen.getAllByRole('button', { name: 'sí' })[0]
  fireEvent.click(word)
  expect(word.closest('.wu')).toHaveTextContent('yes')
  expect(view.container.querySelector('.saved-word-help')).toBeNull()
  fireEvent.click(word)
  expect(screen.queryByText('yes')).toBeNull()
})
