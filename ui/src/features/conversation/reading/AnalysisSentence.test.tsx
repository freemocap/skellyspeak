// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import type { WordGlossView } from '../../../generated/contracts'
import { AnalysisSentence } from './AnalysisSentence'

it('keeps saved Arabic clitics joined in a sentence and reveals their help on request', () => {
  const gloss = { attemptId: 'one', segments: [{start:0,end:2,kind:'gloss',gloss:'the'}, {start:2,end:6,kind:'gloss',gloss:'book'}] } as WordGlossView
  const view = render(<AnalysisSentence label="Your message" text="الكتاب جميل." translation="The book is beautiful." gloss={gloss} />)
  expect(view.container.querySelector('.sentence')?.textContent).toBe('الكتاب جميل.')
  expect(view.container.querySelector('dl')).toBeNull()
  fireEvent.click(screen.getByRole('button', {name:'الكتاب'}))
  expect(view.container.querySelector('.sentence .wg')).toHaveTextContent('the')
  expect(view.container.querySelector('.sentence .saved-word')).toHaveTextContent('book')
})
