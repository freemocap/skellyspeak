// @vitest-environment jsdom
import { expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ExplanationCards, quotedExamples } from './ExplanationCards'

it('splits quoted examples into phrases and meanings', () => {
  expect(quotedExamples('"¡Qué bonito día!" (What a beautiful day!) or “¡Qué rápido corres!” (How fast you run!)')).toEqual([
    { target: '¡Qué bonito día!', meaning: 'What a beautiful day!' },
    { target: '¡Qué rápido corres!', meaning: 'How fast you run!' },
  ])
  expect(quotedExamples('Use it after a greeting.')).toBeNull()
})

it('numbers cards, folds long explanations and names the comparison language', () => {
  const body = 'The partner uses qué to react. '.repeat(12)
  render(<ExplanationCards nativeLanguageName="English" cards={[
    { title: 'Reacting with qué', body, example: '"¡Qué bonito día!" (What a beautiful day!)', contrast: 'English needs “how” or “what a”.' },
    { title: 'Present progressive', body: 'Something happening now.' },
  ]} />)
  expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(2)
  expect(screen.getByRole('heading', { name: 'Reacting with qué' })).toBeTruthy()
  expect(screen.getByText('What a beautiful day!')).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Compared with English' })).toBeTruthy()
  const fold = screen.getByRole('button', { name: 'Show the full explanation' })
  expect(fold).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(fold)
  expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getAllByRole('button', { name: /full explanation|Show less/ })).toHaveLength(1)
})
