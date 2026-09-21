// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react'
import { expect, it } from 'vitest'
import { ReadingPreferencesContext } from './ReadingPreferences'
import { SavedGlossText } from './SavedGlossText'
import { AnnotatedText } from './TargetText'

it.each(['किताब', 'नमस्ते', 'വീട്ടിൽ', 'ന്\u200d'])('renders %s as one uninterrupted source node with independently anchored glosses', text => {
  const segments = [
    { start: 0, end: 1, kind: 'gloss' as const, gloss: 'first' },
    { start: 1, end: text.length, kind: 'gloss' as const, gloss: 'rest' },
  ]
  const view = render(<ReadingPreferencesContext value={{autoTranslate:true, alwaysRomanize:false, alwaysPronunciation:false}}><SavedGlossText text={text} segments={segments} showAids={false} /></ReadingPreferencesContext>)
  expect(view.container.textContent).toBe(text)
  const word = screen.getByRole('button', { name: text })
  expect(word.childNodes).toHaveLength(1)
  fireEvent.click(word)
  expect(document.querySelectorAll('[data-gloss-start]')).toHaveLength(2)
  expect(word.textContent).toBe(text)
})

it.each(['नमस्ते', 'മലയാളം'])('uses the same shaping protection for suggested reply tokens in %s', text => {
  const tokens = [text.slice(0, 1), text.slice(1)].map(text => ({ text, gloss: 'meaning', romanization: null, pronunciation: null, pos: null, notable: false }))
  render(<AnnotatedText text={text} tokens={tokens} />)
  const word = screen.getByRole('button', { name: text })
  expect(word.childNodes).toHaveLength(1)
})
