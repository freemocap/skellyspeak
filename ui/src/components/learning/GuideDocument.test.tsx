// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { GuideDocument } from './GuideDocument'
const target = vi.hoisted(() => vi.fn())
vi.mock('../reading/TargetText', async original => ({
  ...await original<typeof import('../reading/TargetText')>(),
  TargetText: ({ text }: { text: string }) => { target(text); return <span>{text}</span> },
}))
it('renders lesson hierarchy and routes exact examples through shared target reading', () => {
  render(<GuideDocument text={'# Past reference\n\n## How it works\n\n### A completed event\n\nUse `fui` for this example.\n\n> Ayer fui al mercado.\n\nYesterday I went to the market.\n\n## Editorial notes\n\nSpeaker review pending.'} />)
  expect(screen.getByRole('heading', { name: 'Past reference', level: 3 })).toBeVisible()
  expect(screen.getByRole('heading', { name: 'A completed event', level: 5 })).toBeVisible()
  expect(target).toHaveBeenCalledWith('Ayer fui al mercado.')
  expect(target).toHaveBeenCalledWith('fui')
  expect(screen.getByText('Yesterday I went to the market.')).toBeVisible()
  expect(screen.getByText('Speaker review pending.').closest('details')).not.toHaveAttribute('open')
})
