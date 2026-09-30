// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { AiViewPanel } from '../../src/features/activity/AiViewPanel'
import DevWindow from '../../src/app/windows/DevWindow'
import { useAiWindowStore } from '../../src/state/navigation/ai-window'
import { aiTraySlot, useAiTrayStore } from '../../src/state/navigation/ai-tray'
import { useNavigationStore } from '../../src/state/navigation/navigation'

const mocks = vi.hoisted(() => ({ native: vi.fn(), mobile: false, openAiWindow: vi.fn(), dockAiWindow: vi.fn(), aiWindowState: vi.fn() }))
// The Back stack's own tests cover history; here, what each layer registers with it.
const back = vi.hoisted(() => ({ closers: [] as (() => void)[] }))
vi.mock('../../src/domain/input/back', () => ({ openOverlay: (closer: () => void) => {
  back.closers.push(closer)
  return () => { back.closers.splice(back.closers.indexOf(closer), 1) }
} }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.native }))
vi.mock('../../src/components/layout/useIsMobile', () => ({ useIsMobile: () => mocks.mobile }))
vi.mock('../../src/components/dialogs/DetailDialog', () => ({ DetailDialog: ({ children }: { children: React.ReactNode }) => <div role="dialog">{children}</div> }))
vi.mock('../../src/platform/ipc/window', () => ({ openAiWindow: mocks.openAiWindow, dockAiWindow: mocks.dockAiWindow, aiWindowState: mocks.aiWindowState }))
vi.mock('../../src/platform/ipc/tauri', () => ({ getSettings: () => new Promise(() => {}), isTauri: true, languages: () => [], languageFor: () => null }))
vi.mock('../../src/features/activity/AiView', () => ({ AiView: ({ mode, actions }: { mode: string; actions: React.ReactNode }) => <section><p role="status">AI view {mode}</p>{actions}</section> }))
beforeEach(() => {
  vi.clearAllMocks(); mocks.mobile = false
  useAiWindowStore.setState({ supported: false, open: false })
  useAiTrayStore.setState({ slot: null })
  useNavigationStore.setState({ aiInspection: null })
})

/// The place a page with a recording panel gives the phone's AI tray.
function recordingPanelSlot() {
  const slot = document.createElement('div')
  document.body.append(slot)
  let release: () => void = () => {}
  act(() => { release = aiTraySlot(slot) ?? release })
  return { slot, remove: () => act(() => { release(); slot.remove() }) }
}

it.each([false, true])('opens and reopens the AI View without native graph work (mobile=%s)', mobile => {
  mocks.mobile = mobile
  const onOpenChange = vi.fn()
  const view = render(<AiViewPanel open onOpenChange={onOpenChange} />)
  expect(screen.getByRole('status')).toHaveTextContent(mobile ? 'AI view screen' : 'AI view docked')
  expect(mobile ? screen.getByRole('dialog') : view.container.querySelector('.logs-panel')).not.toBeNull()
  view.rerender(<AiViewPanel open={false} onOpenChange={onOpenChange} />)
  expect(screen.queryByRole('status')).toBeNull()
  view.rerender(<AiViewPanel open onOpenChange={onOpenChange} />)
  expect(mocks.native).not.toHaveBeenCalled()
})

it('closes the phone view from its own header, with no close column beside the view', () => {
  mocks.mobile = true
  const onOpenChange = vi.fn()
  render(<AiViewPanel open onOpenChange={onOpenChange} />)
  fireEvent.click(screen.getByRole('button', { name: 'Close AI activity' }))
  expect(onOpenChange).toHaveBeenCalledWith(false)
})

it('opens on phones as a tray above the recording panel, which expands to the full screen and back', () => {
  mocks.mobile = true
  const recording = recordingPanelSlot()
  const onOpenChange = vi.fn()
  render(<AiViewPanel open onOpenChange={onOpenChange} />)
  expect(within(recording.slot).getByRole('status')).toHaveTextContent('AI view tray')
  expect(within(recording.slot).getByRole('separator', { name: 'Resize panel' })).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Expand to full window' }))
  expect(screen.getByRole('dialog')).toHaveTextContent('AI view screen')
  expect(recording.slot).toBeEmptyDOMElement()
  fireEvent.click(screen.getByRole('button', { name: 'Restore above the recording panel' }))
  expect(within(recording.slot).getByRole('status')).toHaveTextContent('AI view tray')
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(within(recording.slot).getByRole('button', { name: 'Close AI activity' }))
  expect(onOpenChange).toHaveBeenCalledWith(false)
  recording.remove()
})

it('opens full screen on phones where no recording panel shows, with no tray to restore to', () => {
  mocks.mobile = true
  render(<AiViewPanel open onOpenChange={vi.fn()} />)
  expect(screen.getByRole('dialog')).toHaveTextContent('AI view screen')
  expect(screen.queryByRole('button', { name: 'Restore above the recording panel' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Expand to full window' })).toBeNull()
})

it('inspects a named operation on phones full screen, from a closed view or an open tray', () => {
  mocks.mobile = true
  const recording = recordingPanelSlot()
  const selection = { conversationId: 'chat', turnId: 'turn', operationKind: 'persona_reply' }
  act(() => useNavigationStore.getState().inspectAi(selection))
  const view = render(<AiViewPanel open onOpenChange={vi.fn()} />)
  expect(screen.getByRole('dialog')).toHaveTextContent('AI view screen')
  view.rerender(<AiViewPanel open={false} onOpenChange={vi.fn()} />)
  act(() => useNavigationStore.setState({ aiInspection: null }))
  view.rerender(<AiViewPanel open onOpenChange={vi.fn()} />)
  expect(within(recording.slot).getByRole('status')).toHaveTextContent('AI view tray')
  act(() => useNavigationStore.getState().inspectAi(selection))
  expect(screen.getByRole('dialog')).toHaveTextContent('AI view screen')
  recording.remove()
})

it('closes the tray with its recording panel, never flashing the full screen instead', () => {
  mocks.mobile = true
  const recording = recordingPanelSlot()
  const onOpenChange = vi.fn()
  render(<AiViewPanel open onOpenChange={onOpenChange} />)
  expect(within(recording.slot).getByRole('status')).toHaveTextContent('AI view tray')
  recording.remove()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.queryByRole('status')).toBeNull()
  expect(onOpenChange).toHaveBeenCalledWith(false)
})

it("closes the phone tray with Back, and leaves Back to the full screen's own dialog", () => {
  mocks.mobile = true
  const recording = recordingPanelSlot()
  const onOpenChange = vi.fn()
  render(<AiViewPanel open onOpenChange={onOpenChange} />)
  expect(back.closers).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Expand to full window' }))
  expect(back.closers).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: 'Restore above the recording panel' }))
  act(() => back.closers.at(-1)!())
  expect(onOpenChange).toHaveBeenCalledWith(false)
  recording.remove()
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
