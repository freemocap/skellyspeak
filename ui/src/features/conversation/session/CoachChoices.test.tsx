// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { CoachChoices } from './CoachChoices'
it('keeps persona selection separate and exposes all three coach modes', () => {
  const choose = vi.fn()
  render(<CoachChoices disabled={false} onChoose={choose} />)
  fireEvent.click(screen.getByRole('button',{name:'Let the persona decide'}))
  expect(choose).toHaveBeenLastCalledWith(null)
  for (const [label, mode] of [['Explore','explore'],['Continue practicing','continuePracticing'],['Coach’s choice','coachChoice']]) {
    fireEvent.click(screen.getByRole('button',{name:label}))
    expect(choose).toHaveBeenLastCalledWith(mode)
  }
})
it('disables all starting actions while recording or submitting', () => {
  render(<CoachChoices disabled onChoose={vi.fn()} />)
  for (const name of ['Let the persona decide', 'Explore', 'Continue practicing', 'Coach’s choice']) {
    expect(screen.getByRole('button', { name })).toBeDisabled()
  }
  expect(screen.getByRole('button', { name: 'Information' })).toBeEnabled()
})
