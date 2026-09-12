// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { AnnotatedText, ReadingProvider, TargetText } from './TargetText'
const backend = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('../lib/tauri', () => backend)
const token = { text: 'Hola', gloss: 'hello', pronunciation: 'oh-la', romanization: null, pos: null, notable: false }
beforeEach(() => { backend.invoke.mockReset() })
it('renders mixed-language source punctuation and reveals the quoted word meaning without another request', async () => {
  const source = "Using\t'querer' (to want) · turn 3"
  const tokens = source.split(/\s+/).map(text => ({ ...token, text,
    gloss: text === "'querer'" ? 'to want' : text === '·' ? null : text,
    pronunciation: text === "'querer'" ? 'keh-REHR' : text === '·' ? null : text,
  }))
  backend.invoke.mockResolvedValue({ tokens })
  const view = render(<ReadingProvider settings={null}><TargetText text={source} /></ReadingProvider>)
  const word = await screen.findByRole('button', { name: "'querer'" })
  expect(view.container.querySelector('.target-text')?.textContent).toBe(source)
  expect(screen.queryByRole('button', { name: '·' })).toBeNull()
  fireEvent.click(word)
  expect(screen.getByText('to want')).toBeVisible()
  expect(backend.invoke).toHaveBeenCalledExactlyOnceWith('annotate_text', { text: source, sentence: source })
})
it('prepares annotations on mount and reveals meanings locally across reopening', async () => {
  backend.invoke.mockResolvedValue({ tokens: [token] })
  const view = render(<ReadingProvider settings={null}><TargetText text="Hola" /></ReadingProvider>)
  const word = await screen.findByRole('button', { name: 'Hola' })
  expect(backend.invoke).toHaveBeenCalledExactlyOnceWith('annotate_text', { text: 'Hola', sentence: 'Hola' })
  fireEvent.click(word)
  expect(screen.getByText('hello')).toBeVisible()
  fireEvent.click(word)
  expect(screen.queryByText('hello')).toBeNull()
  view.rerender(<ReadingProvider settings={null}><span /></ReadingProvider>)
  view.rerender(<ReadingProvider settings={null}><TargetText text="Hola" /></ReadingProvider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Hola' }))
  expect(screen.getByText('hello')).toBeVisible()
  expect(backend.invoke).toHaveBeenCalledOnce()
})
it('shows preparation failures with an explicit retry, without a word-tap request', async () => {
  backend.invoke.mockRejectedValueOnce(new Error('Provider unavailable')).mockResolvedValue({ tokens: [token] })
  render(<ReadingProvider settings={null}><TargetText text="Hola" /></ReadingProvider>)
  expect(await screen.findByRole('alert')).toHaveTextContent('Provider unavailable')
  expect(screen.queryByRole('button', { name: 'Hola' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Retry word annotations' }))
  expect(await screen.findByRole('button', { name: 'Hola' })).toBeVisible()
  expect(screen.queryByRole('alert')).toBeNull()
})
it('uses saved annotations without requests', () => {
  render(<ReadingProvider settings={null}><AnnotatedText text="Hola" tokens={[token]} /></ReadingProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Hola' }))
  expect(screen.getByText('hello')).toBeVisible()
  expect(screen.queryByText('oh-la')).toBeNull()
  expect(backend.invoke).not.toHaveBeenCalled()
})
it('shares in-flight preparation for duplicate text', async () => {
  backend.invoke.mockResolvedValue({ tokens: [token] })
  render(<ReadingProvider settings={null}><TargetText text="Hola" /><TargetText text="Hola" interactive={false} /></ReadingProvider>)
  await screen.findByRole('button', { name: 'Hola' })
  expect(backend.invoke).toHaveBeenCalledOnce()
})

it('explains a missing native command without offering a futile retry', async () => {
  backend.invoke.mockRejectedValue('Command annotate_text not found')
  render(<ReadingProvider settings={null}><TargetText text="Hola" /></ReadingProvider>)
  const error = await screen.findByRole('alert')
  expect(error).toHaveTextContent('Rebuild and reopen SkellySpeak')
  expect(error).toHaveClass('word-annotation-error')
  expect(screen.queryByRole('button', { name: 'Retry word annotations' })).toBeNull()
  expect(backend.invoke).toHaveBeenCalledOnce()
})
