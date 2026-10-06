// @vitest-environment jsdom
import { expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ExplanationCards } from './ExplanationCards'

it('numbers cards, folds long explanations and keeps the example as one intact string', () => {
  const body = 'The partner uses qué to react. '.repeat(12)
  render(<ExplanationCards nativeLanguageName="English" cards={[
    { title: 'Reacting with qué', body, example: '"¡Qué bonito día!" (What a beautiful day!)', contrast: 'English needs “how” or “what a”.' },
    { title: 'Present progressive', body: 'Something happening now.' },
  ]} />)
  expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(2)
  expect(screen.getByRole('heading', { name: 'Reacting with qué' })).toBeTruthy()
  const fold = screen.getByRole('button', { name: 'Show the full explanation' })
  expect(fold).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('heading', { name: 'Compared with English' })).toBeNull()
  fireEvent.click(fold)
  expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByText('"¡Qué bonito día!" (What a beautiful day!)', { exact: false })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Compared with English' })).toBeTruthy()
  expect(screen.getAllByRole('button', { name: /full explanation|Show less/ })).toHaveLength(1)
})

it('opens a short first card and folds later cards that carry an example or comparison', () => {
  render(<ExplanationCards nativeLanguageName="English" cards={[
    { title: 'Past perfect', body: 'Había plus a participle.', example: 'Ya había comido.', contrast: 'English uses had eaten.' },
    { title: 'Asking what it is about', body: 'De qué se trata asks what something is about.', example: '¿De qué se trata?' },
    { title: 'Greeting', body: 'A short greeting.' },
  ]} />)
  expect(screen.getByText('Ya había comido.', { exact: false })).toBeTruthy()
  expect(screen.queryByText('¿De qué se trata?', { exact: false })).toBeNull()
  expect(screen.getAllByRole('button', { name: 'Show the full explanation' })).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Show the full explanation' }))
  expect(screen.getByText('¿De qué se trata?', { exact: false })).toBeTruthy()
})
