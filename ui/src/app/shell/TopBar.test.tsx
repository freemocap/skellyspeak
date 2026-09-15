// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { TopBar } from './TopBar'
import { useNavigationStore } from '../../state/navigation/navigation'

const viewport = vi.hoisted(() => ({ mobile: false }))
vi.mock('../../components/layout/useIsMobile', () => ({ useIsMobile: () => viewport.mobile }))
vi.mock('../../state/learning/useSkillEvidence', () => ({ useSkillEvidence: () => ({ snapshot: null }) }))
vi.mock('../../platform/ipc/tauri', () => ({ isTauri: true }))

beforeEach(() => {
  viewport.mobile = false
  useNavigationStore.setState(useNavigationStore.getInitialState())
})

it.each([false, true])('keeps conversation creation reachable with mobile=%s', mobile => {
  viewport.mobile = mobile
  const start = vi.fn()
  useNavigationStore.getState().openSkills()
  useNavigationStore.getState().registerNewChat(start)
  render(<TopBar />)
  const button = screen.getByRole('button', { name: 'New conversation' })
  expect(button).toBeEnabled()
  expect(button).toHaveTextContent(mobile ? '+' : 'New conversation')
  fireEvent.click(button)
  expect(start).toHaveBeenCalledTimes(1)
  expect(useNavigationStore.getState()).toMatchObject({ page: 'guided', mode: 'practice', mobileSurface: 'chat' })
  act(() => useNavigationStore.getState().registerNewChat(null))
  expect(button).toBeDisabled()
})
