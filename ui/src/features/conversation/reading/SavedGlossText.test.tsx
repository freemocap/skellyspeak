// @vitest-environment jsdom
import { act, fireEvent, render as renderView, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import type { WordGlossView } from '../../../generated/contracts'
import { ReadingPreferencesContext } from '../../../components/reading/ReadingPreferences'
import { SavedGlossText as SharedSavedGlossText } from './SavedGlossText'
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
const enabled = { autoTranslate: true, alwaysRomanize: true, alwaysPronunciation: true }
function render(node: React.ReactNode) {
  return renderView(node, { wrapper: ({ children }) => <ReadingPreferencesContext value={enabled}>{children}</ReadingPreferencesContext> })
}
function SavedGlossText(props: React.ComponentProps<typeof SharedSavedGlossText>) {
  return <SharedSavedGlossText showAids={false} {...props} />
}

const text = '  sí, sí!\ne\u0301 👩🏽‍💻 مرحبا  '
const result: WordGlossView = {
  sourceMessageId: 'message', targetLanguageId: 'spanish', explanationLanguageId: 'english',
  formatVersion: 'format', templateVersion: 'template', boundaryPolicy: 'policy',
  operationId: 'operation', attemptId: 'attempt', coverage: 'partial',
  segments: [{ start: 2, end: 4, kind: 'gloss', gloss: 'yes' }, { start: 6, end: 8, kind: 'gloss', gloss: 'indeed' }, { start: 10, end: 12, kind: 'gloss', gloss: 'accent' }, { start: 13, end: 20, kind: 'gloss', gloss: 'developer' }, { start: 21, end: 26, kind: 'gloss', gloss: 'hello' }],
}
it('keeps exact source and occurrence anchors, including uncovered graphemes and whitespace', () => {
  const view = render(<SavedGlossText text={text} segments={result.segments} />)
  expect(view.container.textContent).toBe(text)
  expect([...view.container.querySelectorAll('[data-source-start]')].map(node => [node.getAttribute('data-source-start'), node.getAttribute('data-source-end'), node.textContent])).toEqual([['2', '4', 'sí'], ['6', '8', 'sí'], ['10', '12', 'e\u0301'], ['13', '20', '👩🏽‍💻'], ['21', '26', 'مرحبا']])
  fireEvent.click(screen.getAllByRole('button', { name: 'sí' })[1])
  expect(screen.getByText('indeed')).toBeVisible()
  expect(screen.queryByText('yes')).toBeNull()
  fireEvent.keyDown(screen.getAllByRole('button', { name: 'sí' })[1], { key: ' ' })
  expect(view.container.textContent).toBe(text)
  view.rerender(<SavedGlossText text={text} segments={[...result.segments]} />)
  view.unmount()
  render(<SavedGlossText text={text} segments={result.segments} />)
  expect(invoke).not.toHaveBeenCalled()
})
it('does not make literal or unresolved spans interactive', () => {
  const view = render(<SavedGlossText text="Hello?" segments={[{start: 0, end: 5, kind: 'unresolved', gloss: null}, {start: 5, end: 6, kind: 'literal', gloss: null}]} />)
  expect(view.container.textContent).toBe('Hello?')
  expect(screen.queryByRole('button')).toBeNull()
  expect(invoke).not.toHaveBeenCalled()
})

it('shows saved romanization when its reading preference is enabled', () => {
  const reading: WordGlossView = { ...result, segments: [{ start: 0, end: 1, kind: 'gloss', gloss: 'you', romanization: 'nǐ' }] }
  render(<ReadingPreferencesContext value={{ autoTranslate: false, alwaysPronunciation: false, alwaysRomanize: true }}><SavedGlossText showAids text="你" segments={reading.segments} /></ReadingPreferencesContext>)
  expect(screen.getByText('nǐ')).toBeVisible()
  expect(invoke).not.toHaveBeenCalled()
})


it('shows token translations from reading preferences without an inspection click', () => {
  render(<ReadingPreferencesContext value={{ autoTranslate: true, alwaysRomanize: false, alwaysPronunciation: false }}><SavedGlossText showAids text={text} segments={result.segments} /></ReadingPreferencesContext>)
  expect(screen.getByText('yes')).toBeVisible()
  expect(screen.getByText('indeed')).toBeVisible()
})


it('click pins a desktop gloss until the word is clicked again', () => {
  const view = render(<SavedGlossText text={text} segments={result.segments} />)
  const word = screen.getAllByRole('button', { name: 'sí' })[0]
  fireEvent.click(word)
  expect(word.closest('.wu')).toHaveTextContent('yes')
  expect(view.container.querySelector('.saved-word-help')).toHaveAttribute('popover', 'manual')
  fireEvent.click(word)
  expect(screen.queryByText('yes')).toBeNull()
})

/// The helper is opened by the browser's own hover, which is delivered as the
/// bubbling pointerover that React derives pointerenter from.
function hoverEvent(type: 'pointerover' | 'pointerout'): Event {
  const event = new Event(type, { bubbles: true })
  Object.defineProperty(event, 'pointerType', { value: 'mouse' })
  return event
}

it('opens saved word help in the top layer so no clipping host can cut it off', () => {
  vi.useFakeTimers()
  const show = vi.fn()
  const original = HTMLElement.prototype.showPopover
  HTMLElement.prototype.showPopover = show
  try {
    const view = render(<SavedGlossText text={text} segments={result.segments} />)
    const word = view.container.querySelector('.saved-word')!
    fireEvent(word, hoverEvent('pointerover'))
    expect(show).toHaveBeenCalledOnce()
    const help = view.container.querySelector('.saved-word-help')!
    expect(help).toHaveAttribute('popover', 'manual')
    expect(help).toHaveTextContent('yes')
    fireEvent(word, hoverEvent('pointerout'))
    expect(view.container.querySelector('.saved-word-help')).not.toBeNull()
    act(() => vi.advanceTimersByTime(200))
    expect(view.container.querySelector('.saved-word-help')).toBeNull()
  } finally {
    HTMLElement.prototype.showPopover = original
    vi.useRealTimers()
  }
})

it('shapes Arabic clitics as one source word while retaining each gloss anchor', () => {
  const text = '  والكتاب،\nبالبيت؟'
  const segments = [
    { start: 2, end: 3, kind: 'gloss' as const, gloss: 'and' },
    { start: 3, end: 5, kind: 'gloss' as const, gloss: 'the' },
    { start: 5, end: 9, kind: 'gloss' as const, gloss: 'book' },
    { start: 11, end: 12, kind: 'gloss' as const, gloss: 'in' },
    { start: 12, end: 14, kind: 'gloss' as const, gloss: 'the' },
    { start: 14, end: 17, kind: 'gloss' as const, gloss: 'house' },
  ]
  const markers = vi.fn(() => null)
  const view = render(<SavedGlossText text={text} segments={segments} afterSegment={markers} />)
  expect(view.container.textContent).toBe(text)
  const word = screen.getByRole('button', { name: 'والكتاب' })
  expect(word.childNodes).toHaveLength(1) // One shaping run, no flex boxes inside the word.
  expect(screen.getAllByRole('button')).toHaveLength(2)
  fireEvent.keyDown(word, { key: 'Enter' })
  expect([...view.container.querySelectorAll('[data-gloss-start]')].map(node => [node.getAttribute('data-gloss-start'), node.getAttribute('data-gloss-end'), node.querySelector('.gloss-help-source')?.textContent, node.querySelector('.wg')?.textContent])).toEqual([
    ['2', '3', 'و', 'and'], ['3', '5', 'ال', 'the'], ['5', '9', 'كتاب', 'book'],
  ])
  expect(markers).toHaveBeenCalledWith(0, 9)
  expect(markers).toHaveBeenCalledWith(9, 17)
  fireEvent.click(word)
  expect(view.container.textContent).toBe(text)
})

it('keeps uncovered Arabic letters, combining marks and joining controls in the same shaping run', () => {
  const text = 'بِالكتاب ک\u200cتاب'
  const view = render(<SavedGlossText text={text} segments={[{ start: 4, end: 8, kind: 'gloss', gloss: 'book' }, { start: 11, end: 14, kind: 'gloss', gloss: 'book' }]} />)
  expect(view.container.textContent).toBe(text)
  expect(screen.getByRole('button', { name: 'بِالكتاب' }).childNodes).toHaveLength(1)
  expect(screen.getByRole('button', { name: 'ک\u200cتاب' }).childNodes).toHaveLength(1)
})

it('reveals saved meaning and romanization without redundant pronunciation whenever a token is opened', () => {
  render(<SavedGlossText text="你" segments={[{ start: 0, end: 1, kind: 'gloss', gloss: 'you', romanization: 'nǐ', pronunciation: 'nee' }]} />)
  const word = screen.getByRole('button', { name: '你' })
  fireEvent.click(word)
  expect(screen.getByText('you')).toBeVisible()
  expect(screen.getByText('nǐ')).toBeVisible()
  expect(screen.queryByText('nee')).toBeNull()
  expect(word).toHaveAttribute('aria-expanded', 'true')
  fireEvent.click(word)
  fireEvent.click(word)
  expect(screen.getByText('nǐ')).toBeVisible()
  expect(screen.queryByText('nee')).toBeNull()
  expect(screen.queryByRole('button', { name: /^(More|Less)$/ })).toBeNull()
})

it('opens anchored help on narrow screens instead of a bottom sheet', () => {
  const original = window.matchMedia
  const media = vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ ...original(query), matches: true }))
  try {
    render(<SavedGlossText text="你" segments={[{ start: 0, end: 1, kind: 'gloss', gloss: 'you', romanization: 'nǐ' }]} />)
    fireEvent.click(screen.getByRole('button', { name: '你' }))
    const sheet = document.querySelector('.saved-word-help')
    expect(sheet).not.toHaveAttribute('popover')
    expect(sheet).toHaveTextContent('you')
    expect(sheet).toHaveTextContent('nǐ')
  } finally { media.mockRestore() }
})

it('reads a clitic group as one word under the text', () => {
  const view = render(<ReadingPreferencesContext value={{ autoTranslate: true, alwaysRomanize: true, alwaysPronunciation: false }}><SavedGlossText showAids text="الأكلة" segments={[
    { start: 0, end: 2, kind: 'gloss', gloss: 'the', romanization: 'al-' },
    { start: 2, end: 6, kind: 'gloss', gloss: 'dish', romanization: 'aklah' },
  ]} /></ReadingPreferencesContext>)
  expect(view.container.querySelector('.saved-word > .wroman')).toHaveTextContent(/^al-aklah$/)
  expect(view.container.querySelector('.saved-word > .wg')).toHaveTextContent(/^the dish$/)
})

it('keeps a nonempty expansion target when every field is already inline', () => {
  const view = render(<ReadingPreferencesContext value={{ autoTranslate: true, alwaysRomanize: true, alwaysPronunciation: true }}><SavedGlossText showAids text="你" segments={[{ start: 0, end: 1, kind: 'gloss', gloss: 'you', romanization: 'nǐ' }]} /></ReadingPreferencesContext>)
  fireEvent.click(screen.getByRole('button', { name: '你' }))
  expect(screen.getAllByText('you')).toHaveLength(2)
  expect(screen.getAllByText('nǐ')).toHaveLength(2)
  expect(view.container.querySelector('[popover]')).toHaveTextContent('you')
  expect(screen.queryByRole('button', { name: 'More' })).toBeNull()
})

it('keeps anchored help during resize', () => {
  const original = window.matchMedia
  let resize = (_matches: boolean) => {}
  const media = vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ ...original(query), matches: false,
    addEventListener: (_type: string, listener: EventListenerOrEventListenerObject | ((event: MediaQueryListEvent) => void) | null) => { resize = matches => (listener as (event: MediaQueryListEvent) => void)({ matches } as MediaQueryListEvent) },
  }))
  const hide = vi.spyOn(HTMLElement.prototype, 'hidePopover').mockImplementation(function (this: HTMLElement) {
    if (!this.hasAttribute('popover')) throw new Error('Cannot hide an inline element as a popover')
    this.style.display = 'none'
  })
  try {
    const view = render(<SavedGlossText text="你" segments={[{ start: 0, end: 1, kind: 'gloss', gloss: 'you', romanization: 'nǐ' }]} />)
    fireEvent.click(screen.getByRole('button', { name: '你' }))
    act(() => resize(true))
    expect(view.container.querySelector('.saved-word-help')).toHaveAttribute('popover', 'manual')
    expect(screen.getByText('nǐ')).toBeVisible()
    expect(screen.queryByRole('button', { name: /^(More|Less)$/ })).toBeNull()
  } finally { media.mockRestore(); hide.mockRestore() }
})
