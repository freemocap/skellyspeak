// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ConversationHelp } from './ConversationHelp'
import { useOnboardingStore } from '../../../state/settings/onboarding'
import type { Preferences } from '../../../generated/contracts'

beforeEach(() => {
  useOnboardingStore.setState({ busy: false, preferences: { onboardingHelp: true } as Preferences,
    showHelp: vi.fn(async show => { useOnboardingStore.setState({ preferences: { onboardingHelp: show } as Preferences }) }),
  })
})
it('offers coaching only after a real learner turn and keeps dismissal through later replies', async () => {
  const { rerender } = render(<ConversationHelp hasReply hasLearnerTurn={false} />)
  expect(screen.queryByText(/Open Coaching/)).not.toBeInTheDocument()
  rerender(<ConversationHelp hasReply hasLearnerTurn />)
  expect(screen.getByText(/Open Coaching/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss help' }))
  await waitFor(() => expect(screen.queryByLabelText('Conversation help')).not.toBeInTheDocument())
  rerender(<ConversationHelp hasReply hasLearnerTurn={false} />)
  expect(screen.queryByLabelText('Conversation help')).not.toBeInTheDocument()
})
it('retains help and reports an unsuccessful dismissal save', async () => {
  useOnboardingStore.setState({ showHelp: vi.fn().mockRejectedValue(new Error('Revision conflict')) })
  render(<ConversationHelp hasReply={false} hasLearnerTurn={false} />)
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss help' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Revision conflict')
  expect(screen.getByLabelText('Conversation help')).toBeInTheDocument()
})
