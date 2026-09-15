// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { DEFAULT_APPEARANCE } from '../../generated/contracts'
import { useAppearance } from './useAppearance'
import type { Settings } from '../../types'

it('applies appearance globally and clears a previous glow when switched off', () => {
  const settings = { theme: 'dark', appearance: { ...DEFAULT_APPEARANCE, depth: 'recessed', glowEnabled: true } } as Settings
  const view = renderHook(({ settings }) => useAppearance(settings), { initialProps: { settings } })
  const root = document.documentElement
  expect(root.dataset).toMatchObject({ theme: 'dark', palette: 'cool', density: 'standard', spacing: 'tight', depth: 'recessed' })
  expect(root.style.getPropertyValue('--appearance-glow')).toContain('30%')
  view.rerender({ settings: { ...settings, appearance: { ...DEFAULT_APPEARANCE, controlDensity: 'compact', layoutSpacing: 'extra_tight' } } })
  expect(root.dataset).toMatchObject({ density: 'compact', spacing: 'extra_tight', depth: 'subtle' })
  expect(root.style.getPropertyValue('--appearance-glow')).toContain('0%')
})

it('tracks system appearance and removes the listener on unmount', () => {
  const media = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }
  const spy = vi.spyOn(window, 'matchMedia').mockReturnValue(media as unknown as MediaQueryList)
  try {
    const view = renderHook(() => useAppearance({ theme: 'system' } as Settings))
    expect(document.documentElement.dataset.theme).toBe('dark')
    media.matches = false
    media.addEventListener.mock.calls[0][1]()
    expect(document.documentElement.dataset.theme).toBe('light')
    view.unmount()
    expect(media.removeEventListener).toHaveBeenCalledWith('change', media.addEventListener.mock.calls[0][1])
  } finally { spy.mockRestore() }
})
