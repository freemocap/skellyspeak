// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { publishSpeechFollow } from '../../platform/audio/speech-follow'
import { SavedGlossText } from './SavedGlossText'
import { TargetText } from './TargetText'
import { SpeechFollowText } from './SpeechFollowText'
import { ReadingPreferencesContext } from './ReadingPreferences'

afterEach(() => { act(() => publishSpeechFollow(null)); vi.restoreAllMocks() })

function measureRanges() {
  const selected: string[] = []
  Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: function (this: Range) {
    selected.push(this.toString())
    return [new DOMRect(10, 20, 40, 22)]
  } })
  return selected
}

it('highlights only source text with visible glosses and preserves the existing word node', () => {
  const selected = measureRanges()
  const view = render(<ReadingPreferencesContext value={{ autoTranslate: true, alwaysRomanize: true, alwaysPronunciation: true }}>
    <SavedGlossText text="go go" segments={[{ start: 0, end: 2, kind: 'gloss', gloss: 'first', romanization: 'aid' }, { start: 3, end: 5, kind: 'gloss', gloss: 'second' }]} />
  </ReadingPreferencesContext>)
  const word = screen.getAllByRole('button', { name: 'go' })[1]
  act(() => publishSpeechFollow({ text: 'go go', word: { start: 3, end: 5, from: 1, to: 2 } }))
  expect(selected).toEqual(['go'])
  expect(document.querySelectorAll('.speech-follow-word')).toHaveLength(1)
  expect(screen.getAllByRole('button', { name: 'go' })[1]).toBe(word)
  expect(screen.getByText('second')).toBeVisible()
  act(() => publishSpeechFollow(null))
  expect(document.querySelector('.speech-follow-overlay')).toHaveAttribute('data-active', 'false')
  view.unmount()
})

it('supports unannotated text, ignores unrelated text, and removes overlays on unmount', () => {
  const selected = measureRanges()
  const view = render(<><TargetText text="مرحبا بالعالم" /><TargetText text="other text" /></>)
  act(() => publishSpeechFollow({ text: 'مرحبا بالعالم', word: { start: 6, end: 13, from: 1, to: 2 } }))
  expect(selected).toEqual(['بالعالم'])
  expect(document.querySelectorAll('.speech-follow-word')).toHaveLength(1)
  view.unmount()
  expect(document.querySelector('.speech-follow-word')).toBeNull()
})

it('renders highlights inside the owning dialog top layer', () => {
  measureRanges()
  const view = render(<dialog open><TargetText text="hello" /></dialog>)
  act(() => publishSpeechFollow({ text: 'hello', word: { start: 0, end: 5, from: 0, to: 1 } }))
  expect(view.container.querySelector('dialog .speech-follow-word')).not.toBeNull()
})

it('positions a speech highlight in a scrolled dialog without applying its viewport offset twice', () => {
  measureRanges()
  const view = render(<dialog open style={{ position: 'fixed' }}><TargetText text="hello" /></dialog>)
  const dialog = view.container.querySelector('dialog')!
  vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue(new DOMRect(5, 10, 200, 200))
  dialog.scrollTop = 8
  act(() => publishSpeechFollow({ text: 'hello', word: { start: 0, end: 5, from: 0, to: 1 } }))
  expect(dialog.querySelector('.speech-follow-word')).toHaveStyle({ left: '5px', top: '18px' })
})

it('follows the selected repeated occurrence inside an independent helper', () => {
  const selected = measureRanges()
  render(<SpeechFollowText text="go go"><span data-speech-source>go go</span>
    <span className="saved-word-help"><SpeechFollowText text="go" source={{ text: 'go go', start: 3 }}><span data-speech-source>go</span></SpeechFollowText></span>
  </SpeechFollowText>)
  act(() => publishSpeechFollow({ text: 'go go', word: { start: 3, end: 5, from: 0, to: 1 } }))
  expect(selected).toEqual(['go', 'go'])
  expect(document.querySelectorAll('.speech-follow-word')).toHaveLength(2)
})

it('keeps one highlight through word changes and gaps, and repositions immediately on scroll', () => {
  let scroll = 0
  Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: function (this: Range) {
    return [new DOMRect(10 + this.startOffset * 20, 40 - scroll, this.toString().length * 20, 22)]
  } })
  const view = render(<TargetText text="go again" />)
  act(() => publishSpeechFollow({ text: 'go again', word: { start: 0, end: 2, from: 0, to: 1 } }))
  const highlight = document.querySelector('.speech-follow-word')
  expect(highlight).toHaveStyle({ left: '10px', width: '40px' })
  act(() => publishSpeechFollow(null))
  expect(document.querySelector('.speech-follow-word')).toBe(highlight)
  expect(document.querySelector('.speech-follow-overlay')).toHaveAttribute('data-active', 'false')
  act(() => publishSpeechFollow({ text: 'go again', word: { start: 3, end: 8, from: 1.1, to: 2 } }))
  expect(document.querySelector('.speech-follow-word')).toBe(highlight)
  expect(highlight).toHaveStyle({ left: '70px', width: '100px' })
  act(() => { scroll = 10; window.dispatchEvent(new Event('scroll')) })
  expect(highlight).toHaveStyle({ top: '30px' })
  view.unmount()
  expect(document.querySelector('.speech-follow-word')).toBeNull()
})

it('remeasures the highlighted word when its bubble moves without resizing', () => {
  let shift = 0
  const frames: FrameRequestCallback[] = []
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return new DOMRect(this.querySelector('[data-speech-source]') ? shift : 0, 0, 100, 20)
  })
  Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [new DOMRect(10 + shift, 20, 40, 22)] })
  const view = render(<div className="msg"><TargetText text="hello" /></div>)
  act(() => publishSpeechFollow({ text: 'hello', word: { start: 0, end: 5, from: 0, to: 1 } }))
  expect(document.querySelector('.speech-follow-word')).toHaveStyle({ left: '10px' })
  shift = 30
  act(() => frames.shift()!(0))
  expect(document.querySelector('.speech-follow-word')).toHaveStyle({ left: '40px' })
  view.unmount()
})
