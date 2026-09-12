// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { LogsOverlay } from './LogsOverlay'
import DevWindow from '../../DevWindow'

const mocks = vi.hoisted(() => ({ native: vi.fn(), mobile: false }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.native }))
vi.mock('../../platform/ipc/tauri', () => ({ openDevWindow: mocks.native }))
vi.mock('../../ui/useIsMobile', () => ({ useIsMobile: () => mocks.mobile }))
vi.mock('../../ui/DetailDialog', () => ({ DetailDialog: ({ children }: { children: React.ReactNode }) => <div role="dialog">{children}</div> }))
beforeEach(() => { vi.clearAllMocks(); mocks.mobile = false })
it.each([false, true])('opens and reopens the existing AI frame without native graph work (mobile=%s)', mobile => {
  mocks.mobile = mobile
  const onOpenChange = vi.fn()
  const view = render(<LogsOverlay open onOpenChange={onOpenChange} />)
  expect(screen.getByRole('status')).toHaveTextContent('Live operations')
  expect(view.container.querySelector(mobile ? '.mobile-ai-panel' : '.logs-panel')).not.toBeNull()
  view.rerender(<LogsOverlay open={false} onOpenChange={onOpenChange} />)
  view.rerender(<LogsOverlay open onOpenChange={onOpenChange} />)
  expect(mocks.native).not.toHaveBeenCalled()
})
it('opens the separate AI window without mounting trace or gate controllers', () => {
  const view = render(<DevWindow />)
  expect(view.container.querySelector('.dev-window')).not.toBeNull()
  expect(screen.getByRole('status')).toHaveTextContent('Live operations')
  expect(mocks.native).not.toHaveBeenCalled()
})

vi.mock('./LiveActivity', () => ({ LiveActivity: () => <p role="status">Live operations</p> }))
