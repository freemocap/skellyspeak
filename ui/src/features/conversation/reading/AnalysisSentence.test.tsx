// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import type { WordGlossView } from '../../../generated/contracts'
import { ReadingPreferencesContext } from '../../../components/reading/ReadingPreferences'
import { AnalysisSentence } from './AnalysisSentence'

/** Opens every message's ⋯ menu, where Words, Analysis and Pronunciation live. */
const openMenus = () => screen.queryAllByRole('button', { name: 'More actions' }).forEach(button => { if (button.getAttribute('aria-expanded') !== 'true') fireEvent.click(button) })


it('keeps saved Arabic clitics joined in a sentence and reveals their help on request', () => {
  const gloss = { attemptId: 'one', segments: [{start:0,end:2,kind:'gloss',gloss:'the'}, {start:2,end:6,kind:'gloss',gloss:'book'}] } as WordGlossView
  const view = render(<ReadingPreferencesContext value={{autoTranslate:true, alwaysRomanize:false, alwaysPronunciation:false}}><AnalysisSentence label="Your message" text="الكتاب جميل." translation="The book is beautiful." gloss={gloss} /></ReadingPreferencesContext>)
  openMenus()
  fireEvent.click(screen.getByRole('button', {name:'Words'}))
  expect(view.container.querySelector('.msg .reading-word')?.textContent).toBe('الكتاب')
  expect(view.container.querySelector('dl')).toBeNull()
  fireEvent.click(screen.getByRole('button', {name:'الكتاب'}))
  expect(view.container.querySelector('.msg .wg')).toHaveTextContent('the')
  expect(view.container.querySelector('.msg .saved-word')).toHaveTextContent('book')
})
