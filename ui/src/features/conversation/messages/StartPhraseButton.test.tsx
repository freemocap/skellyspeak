// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { StartPhraseButton } from './StartPhraseButton'

it('sends the exact source, prevents duplicate clicks and exposes failures', async () => {
  let reject!: (reason: Error) => void
  const start = vi.fn(() => new Promise<void>((_, fail) => { reject = fail }))
  render(<StartPhraseButton messageId="message" text={'cafe\u0301!'} onStart={start} />)
  const button = screen.getByRole('button', { name: 'Start conversation from this message' })
  fireEvent.click(button); fireEvent.click(button)
  expect(start).toHaveBeenCalledExactlyOnceWith('message', 'cafe\u0301!')
  await act(async () => reject(new Error('Source changed')))
  expect(screen.getByText('Source changed')).toBeVisible()
  expect(button).not.toBeDisabled()
})

it('captures selected source text before the action takes focus', () => {
  const start = vi.fn().mockResolvedValue(undefined)
  const view = render(<div className="msg"><span data-phrase-source><span data-speech-source>Hola, amigo.</span></span><StartPhraseButton messageId="message" text="Hola, amigo." onStart={start} /></div>)
  const source = view.container.querySelector('[data-speech-source]')!.firstChild!
  const range = document.createRange(); range.setStart(source, 6); range.setEnd(source, 11)
  const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range)
  const button = screen.getByRole('button', { name: 'Start conversation from this message' })
  fireEvent.pointerDown(button); selection.removeAllRanges(); fireEvent.click(button)
  expect(start).toHaveBeenCalledWith('message', 'amigo')
})

it('visibly expands a partial selection across decorated words and excludes annotations', () => {
  const start = vi.fn().mockResolvedValue(undefined)
  const text = 'cat scatter cafe\u0301!'
  const view = render(<div className="msg"><span data-phrase-source>
    <span data-speech-source>cat </span><span><span data-speech-source>scatter</span><span>meaning</span></span>
    <span data-speech-source>{' cafe\u0301!'}</span>
  </span><div>Translation</div><StartPhraseButton messageId="message" text={text} onStart={start} /></div>)
  const nodes = view.container.querySelectorAll('[data-speech-source]')
  const range = document.createRange(); range.setStart(nodes[1].firstChild!, 1); range.setEnd(nodes[2].firstChild!, 4)
  const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range)
  fireEvent.pointerUp(document)
  expect(selection.getRangeAt(0).startOffset).toBe(0)
  expect(selection.getRangeAt(0).endOffset).toBe(6)
  const button = screen.getByRole('button', { name: 'Start conversation from this message' })
  fireEvent.pointerDown(button); selection.removeAllRanges(); fireEvent.click(button)
  expect(start).toHaveBeenCalledWith('message', 'scatter cafe\u0301')
})
