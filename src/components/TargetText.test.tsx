// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { AnnotatedText, ReadingProvider, TargetText } from './TargetText'
const backend = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('../lib/tauri', () => backend)
const token = { text: 'Hola', gloss: 'hello', pronunciation: 'oh-la', romanization: null, pos: null, notable: false }
beforeEach(() => { HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", "") }; HTMLDialogElement.prototype.close = function () { this.removeAttribute("open") }; backend.invoke.mockReset() })
it('renders and reopens distinct reading fragments without requesting annotations', () => {
  const content = <>{Array.from({ length: 70 }, (_, i) => <TargetText key={i} text={`Suggestion ${i}`} />)}</>
  const view = render(<ReadingProvider settings={null}>{content}</ReadingProvider>)
  view.rerender(<ReadingProvider settings={null}><span /></ReadingProvider>)
  view.rerender(<ReadingProvider settings={null}>{content}</ReadingProvider>)
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
