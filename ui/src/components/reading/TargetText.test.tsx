// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { Settings } from '../../types'
import { SavedGlossText } from './SavedGlossText'
import { AnnotatedText, ReadingProvider, TargetText } from './TargetText'
const backend = vi.hoisted(() => ({ invoke: vi.fn(), languageFor: (id: string) => ({ romanization: id === 'mandarin' ? 'pinyin' : null }) }))
vi.mock('../../platform/ipc/tauri', () => backend)
const token = { text: 'Hola', gloss: 'hello', pronunciation: 'oh-la', romanization: null, pos: null, notable: false }
beforeEach(() => { HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", "") }; HTMLDialogElement.prototype.close = function () { this.removeAttribute("open") }; backend.invoke.mockReset() })
it('renders and reopens distinct reading fragments without requesting annotations', () => {
  const content = <>{Array.from({ length: 70 }, (_, i) => <TargetText key={i} text={`Suggestion ${i}`} />)}</>
  const view = render(<ReadingProvider settings={null}>{content}</ReadingProvider>)
  for (let i = 0; i < 70; i++) expect(screen.getByText(`Suggestion ${i}`)).toBeInTheDocument()
  view.rerender(<ReadingProvider settings={null}><span /></ReadingProvider>)
  expect(screen.queryByText('Suggestion 0')).not.toBeInTheDocument()
  view.rerender(<ReadingProvider settings={null}>{content}</ReadingProvider>)
  for (let i = 0; i < 70; i++) expect(screen.getByText(`Suggestion ${i}`)).toBeInTheDocument()
  expect(backend.invoke).not.toHaveBeenCalled()
})
it('preserves punctuation without AI preparation', () => {
  const source = "Using\t'querer' (to want) · turn 3"
  const view = render(<ReadingProvider settings={null}><TargetText text={source} /></ReadingProvider>)
  expect(view.container.querySelector('.target-text')?.textContent).toBe(source)
  expect(backend.invoke).not.toHaveBeenCalled()
})
it('uses saved annotations without requests', () => {
  render(<ReadingProvider settings={null}><AnnotatedText text="Hola" tokens={[token]} /></ReadingProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Hola' }))
  expect(screen.getByText('hello')).toBeVisible()
  expect(backend.invoke).not.toHaveBeenCalled()
})
it('leaves missing word help inert on click, keyboard and context menu', () => {
  render(<ReadingProvider settings={null}><TargetText text="Hola" /></ReadingProvider>)
  const source = screen.getByText('Hola')
  fireEvent.click(source)
  fireEvent.keyDown(source, {key: 'Enter'})
  fireEvent.contextMenu(source)
  expect(screen.queryByRole('button')).toBeNull()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(backend.invoke).not.toHaveBeenCalled()
})
it('leaves noninteractive reading text inert', () => {
  render(<ReadingProvider settings={null}><TargetText text="Hola" interactive={false} /></ReadingProvider>)
  fireEvent.click(screen.getByText('Hola'))
  expect(screen.queryByRole('button')).toBeNull()
  expect(backend.invoke).not.toHaveBeenCalled()
})

it('preserves joined Arabic source words across semantic token boundaries', () => {
  const text = 'الكتاب  هنا؟'
  const view = render(<AnnotatedText text={text} tokens={[{ ...token, text: 'ال', gloss: 'the' }, { ...token, text: 'كتاب', gloss: 'book' }]} />)
  expect(view.container.textContent).toBe(text)
  expect(screen.getByRole('button', { name: 'الكتاب' }).childNodes).toHaveLength(1)
})

it('suppresses saved Spanish romanization even with the global preference enabled, without hiding pronunciation', () => {
  const settings = { target_language: 'spanish', always_romanize: true, always_pronunciation: true } as Settings
  const view = render(<ReadingProvider settings={settings}><SavedGlossText text="Hola" segments={[{ start: 0, end: 4, kind: 'gloss', gloss: 'hello', romanization: 'Hola', pronunciation: 'OH-lah' }]} /></ReadingProvider>)
  expect(view.container.querySelector('.wroman')).toBeNull()
  expect(screen.getByText('OH-lah')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Hola' }))
  expect(view.container.querySelector('.wroman')).toBeNull()
  expect(screen.getByText('hello')).toBeVisible()
  view.rerender(<ReadingProvider settings={{ ...settings, target_language: 'mandarin' }}><SavedGlossText text="你" segments={[{ start: 0, end: 1, kind: 'gloss', gloss: 'you', romanization: 'nǐ' }]} /></ReadingProvider>)
  expect(screen.getByText('nǐ')).toBeVisible()
  expect(backend.invoke).not.toHaveBeenCalled()
})

it('applies the selected language script override independently of reading size', () => {
  const settings = {target_language:'arabic',target_variety:'arabic-levantine',script_scales:{arabic:2},text_size:125} as unknown as Settings
  const view = render(<ReadingProvider settings={settings}><TargetText text="مرحبا" /></ReadingProvider>)
  expect(document.documentElement.style.getPropertyValue('--script-scale')).toBe('2')
  expect(document.documentElement.style.getPropertyValue('--reading-scale')).toBe('1.25')
  view.rerender(<ReadingProvider settings={{...settings,script_scales:{arabic:1.25}}}><TargetText text="مرحبا" /></ReadingProvider>)
  expect(document.documentElement.style.getPropertyValue('--script-scale')).toBe('1.25')
})
