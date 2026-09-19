// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { AiViewPanel } from '../../src/features/activity/AiViewPanel'
import DevWindow from '../../src/app/windows/DevWindow'
import { useAiWindowStore } from '../../src/state/navigation/ai-window'

const mocks = vi.hoisted(() => ({ native: vi.fn(), mobile: false, openAiWindow: vi.fn(), dockAiWindow: vi.fn(), aiWindowState: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.native }))
vi.mock('../../src/components/layout/useIsMobile', () => ({ useIsMobile: () => mocks.mobile }))
vi.mock('../../src/components/dialogs/DetailDialog', () => ({ DetailDialog: ({ children }: { children: React.ReactNode }) => <div role="dialog">{children}</div> }))
vi.mock('../../src/platform/ipc/window', () => ({ openAiWindow: mocks.openAiWindow, dockAiWindow: mocks.dockAiWindow, aiWindowState: mocks.aiWindowState }))
vi.mock('../../src/platform/ipc/tauri', () => ({ getSettings: () => new Promise(() => {}), isTauri: true }))
vi.mock('../../src/features/activity/AiView', () => ({ AiView: ({ mode, actions }: { mode: string; actions: React.ReactNode }) => <section><p role="status">AI view {mode}</p>{actions}</section> }))
beforeEach(() => {
  vi.clearAllMocks(); mocks.mobile = false
  useAiWindowStore.setState({ supported: false, open: false })
})

it.each([false, true])('opens and reopens the AI View without native graph work (mobile=%s)', mobile => {
  mocks.mobile = mobile
  const onOpenChange = vi.fn()
  const view = render(<AiViewPanel open onOpenChange={onOpenChange} />)
  expect(screen.getByRole('status')).toHaveTextContent(mobile ? 'AI view expanded' : 'AI view docked')
  expect(view.container.ownerDocument.querySelector(mobile ? '.mobile-ai-panel' : '.logs-panel')).not.toBeNull()
  view.rerender(<AiViewPanel open={false} onOpenChange={onOpenChange} />)
  expect(screen.queryByRole('status')).toBeNull()
  view.rerender(<AiViewPanel open onOpenChange={onOpenChange} />)
  expect(mocks.native).not.toHaveBeenCalled()
})

it('expands into a full-window pop-over and restores to the bottom panel', () => {
  const view = render(<AiViewPanel open onOpenChange={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Expand to full window' }))
  expect(screen.getByRole('status')).toHaveTextContent('AI view expanded')
  expect(view.container.querySelector('.ai-panel-expanded')).not.toBeNull()
  expect(view.container.querySelector('.logs-resize')).toBeNull()
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(screen.getByRole('status')).toHaveTextContent('AI view docked')
})

it('offers pop-out only where native supports windows, and closes the panel after it', async () => {
  const onOpenChange = vi.fn()
  const view = render(<AiViewPanel open onOpenChange={onOpenChange} />)
  expect(screen.queryByRole('button', { name: 'Pop out into its own window' })).toBeNull()
  useAiWindowStore.setState({ supported: true })
  view.rerender(<AiViewPanel open onOpenChange={onOpenChange} />)
  mocks.openAiWindow.mockResolvedValue(undefined)
  mocks.aiWindowState.mockResolvedValue({ supported: true, open: true })
  fireEvent.click(screen.getByRole('button', { name: 'Pop out into its own window' }))
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  await waitFor(() => expect(useAiWindowStore.getState().open).toBe(true))
})

it('renders the popped-out view with a pop-in control', () => {
  mocks.dockAiWindow.mockResolvedValue(undefined)
  const view = render(<DevWindow />)
  expect(view.container.querySelector('.dev-window')).not.toBeNull()
  expect(screen.getByRole('status')).toHaveTextContent('AI view window')
  fireEvent.click(screen.getByRole('button', { name: 'Pop in' }))
  expect(mocks.dockAiWindow).toHaveBeenCalledOnce()
})
