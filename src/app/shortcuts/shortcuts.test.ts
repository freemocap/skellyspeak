// @vitest-environment jsdom
import { fireEvent, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSettingsShortcut } from './useSettingsShortcut'
import { useTextSizeShortcut } from './useTextSizeShortcut'

afterEach(() => { vi.restoreAllMocks() })

describe('settings shortcut', () => {
  it('toggles settings on the configured combination', () => {
    const onToggle = vi.fn()
    renderHook(() => useSettingsShortcut({ enabled: true, shortcut: 'ctrl+,', busy: false, onToggle }))
    fireEvent.keyDown(window, { key: ',', ctrlKey: true })
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('does nothing while a save is in flight', () => {
    const onToggle = vi.fn()
    renderHook(() => useSettingsShortcut({ enabled: true, shortcut: 'ctrl+,', busy: true, onToggle }))
    fireEvent.keyDown(window, { key: ',', ctrlKey: true })
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('does not listen while disabled', () => {
    const onToggle = vi.fn()
    renderHook(() => useSettingsShortcut({ enabled: false, shortcut: 'ctrl+,', busy: false, onToggle }))
    fireEvent.keyDown(window, { key: ',', ctrlKey: true })
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('ignores key repeat', () => {
    const onToggle = vi.fn()
    renderHook(() => useSettingsShortcut({ enabled: true, shortcut: 'ctrl+,', busy: false, onToggle }))
    fireEvent.keyDown(window, { key: ',', ctrlKey: true, repeat: true })
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('stops listening once unmounted', () => {
    const onToggle = vi.fn()
    const view = renderHook(() => useSettingsShortcut({ enabled: true, shortcut: 'ctrl+,', busy: false, onToggle }))
    view.unmount()
    fireEvent.keyDown(window, { key: ',', ctrlKey: true })
    expect(onToggle).not.toHaveBeenCalled()
  })
})

describe('text size shortcut', () => {
  it.each([['+', 'increase'], ['-', 'decrease'], ['0', 'reset']])('maps %s to %s', (key, action) => {
    const onChange = vi.fn()
    renderHook(() => useTextSizeShortcut(onChange))
    fireEvent.keyDown(window, { key, ctrlKey: true })
    expect(onChange).toHaveBeenCalledWith(action)
  })

  it('accepts the platform modifier on either side', () => {
    const onChange = vi.fn()
    renderHook(() => useTextSizeShortcut(onChange))
    fireEvent.keyDown(window, { key: '=', metaKey: true })
    expect(onChange).toHaveBeenCalledWith('increase')
  })

  it('leaves an unmodified key alone', () => {
    const onChange = vi.fn()
    renderHook(() => useTextSizeShortcut(onChange))
    fireEvent.keyDown(window, { key: '+' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('always calls the latest handler', () => {
    const first = vi.fn()
    const second = vi.fn()
    const view = renderHook(({ onChange }) => useTextSizeShortcut(onChange), { initialProps: { onChange: first } })
    view.rerender({ onChange: second })
    fireEvent.keyDown(window, { key: '-', ctrlKey: true })
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith('decrease')
  })
})

// `useReloadShortcut` is not covered here. jsdom defines `window.location` and
// its `reload` as non-configurable, so navigation cannot be intercepted without
// adding an injection seam to production code purely for the test. The predicate
// it depends on is covered by `src/lib/reload.test.ts`; what remains untested is
// a fifteen-line wrapper that attaches one listener.
