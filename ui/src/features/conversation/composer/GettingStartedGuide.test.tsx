// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { GettingStartedGuide } from './GettingStartedGuide'
import { useOnboardingStore } from '../../../state/settings/onboarding'
import type { Preferences } from '../../../generated/contracts'

beforeEach(() => {
  useOnboardingStore.setState({ busy: false, preferences: { onboardingHelp: true } as Preferences,
    showHelp: vi.fn(async show => { useOnboardingStore.setState({ preferences: { onboardingHelp: show } as Preferences }) }),
  })
})
const guide = () => screen.getByRole('region', { name: 'Getting started' })

it('follows the conversation from speaking, to reading the reply, to feedback', () => {
  const record = vi.fn(), coach = vi.fn()
  const view = render(<GettingStartedGuide hasReply={false} hasLearnerTurn={false} canRecord onRecord={record} onOpenCoach={coach} />)
  expect(within(guide()).getByRole('heading', { name: 'Say something' })).toBeVisible()
  expect(within(guide()).getAllByRole('listitem')[0]).toHaveAttribute('aria-current', 'step')
  fireEvent.click(within(guide()).getByRole('button', { name: 'Record' }))
  expect(record).toHaveBeenCalledOnce()
  view.rerender(<GettingStartedGuide hasReply hasLearnerTurn={false} canRecord onRecord={record} onOpenCoach={coach} />)
  expect(within(guide()).getByRole('heading', { name: 'Read the reply' })).toBeVisible()
  expect(within(guide()).getAllByRole('listitem')[0]).toHaveAttribute('data-state', 'done')
  view.rerender(<GettingStartedGuide hasReply hasLearnerTurn canRecord onRecord={record} onOpenCoach={coach} />)
  expect(within(guide()).queryByRole('button', { name: 'Record' })).toBeNull()
  fireEvent.click(within(guide()).getByRole('button', { name: 'Open Coach' }))
  expect(coach).toHaveBeenCalledOnce()
})

it('disables Record while recording is unavailable', () => {
  render(<GettingStartedGuide hasReply={false} hasLearnerTurn={false} canRecord={false} onRecord={vi.fn()} onOpenCoach={vi.fn()} />)
  expect(within(guide()).getByRole('button', { name: 'Record' })).toBeDisabled()
})

it('stays hidden once hidden, through later replies', async () => {
  const view = render(<GettingStartedGuide hasReply={false} hasLearnerTurn={false} canRecord onRecord={vi.fn()} onOpenCoach={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Hide getting started' }))
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Getting started' })).toBeNull())
  view.rerender(<GettingStartedGuide hasReply hasLearnerTurn canRecord onRecord={vi.fn()} onOpenCoach={vi.fn()} />)
  expect(screen.queryByRole('region', { name: 'Getting started' })).toBeNull()
})

it('keeps the guide and reports an unsuccessful hide', async () => {
  useOnboardingStore.setState({ showHelp: vi.fn().mockRejectedValue(new Error('Revision conflict')) })
  render(<GettingStartedGuide hasReply={false} hasLearnerTurn={false} canRecord onRecord={vi.fn()} onOpenCoach={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Hide getting started' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Revision conflict')
  expect(guide()).toBeInTheDocument()
})
