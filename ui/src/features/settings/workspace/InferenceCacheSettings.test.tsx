// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../components/localization/i18n'
import { InferenceCacheSettings } from './InferenceCacheSettings'
const api = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('../../../platform/ipc/tauri', () => api)
beforeEach(() => {
  vi.resetAllMocks()
  api.invoke.mockImplementation(async (command: string) => command === 'get_inference_cache_settings'
    ? { capacityBytes: 268435456, usedBytes: 1048576, resultCount: 2 }
    : { capacityBytes: 0, usedBytes: 0, resultCount: 0 })
})
function open() { render(<I18nProvider locale="english"><InferenceCacheSettings /></I18nProvider>) }
it('loads native capacity and applies zero without changing recording retention', async () => {
  open()
  const field = screen.getByLabelText('Cache capacity (MiB)')
  await waitFor(() => expect(field).toHaveValue(256))
  fireEvent.change(field, { target: { value: '0' } })
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
  await waitFor(() => expect(api.invoke).toHaveBeenLastCalledWith('save_inference_cache_settings', { capacityBytes: 0 }))
  expect(await screen.findByText('Cached: 0 MiB · results: 0')).toBeInTheDocument()
})
it('rejects fractional limits before invoking native storage', async () => {
  open()
  const field = screen.getByLabelText('Cache capacity (MiB)')
  await waitFor(() => expect(field).toHaveValue(256))
  fireEvent.change(field, { target: { value: '0.5' } })
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Enter a whole number')
  expect(api.invoke).toHaveBeenCalledTimes(1)
})
