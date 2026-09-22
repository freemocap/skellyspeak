import { setPlaybackAllowed } from './speech'
import { setRewardPlaybackAllowed, unlockRewardAudio } from './reward-sounds'

export interface PlaybackLifecycle {
  focus: (focused: boolean) => void
  suspend: () => void
  resume: () => void
  close: () => void
  dispose: () => void
}

/** Independent blockers prevent a focus event from overriding mobile suspension. */
export function installPlaybackLifecycle(): PlaybackLifecycle {
  const blocked = new Set<string>()
  const update = (): void => {
    const allowed = blocked.size === 0 && document.visibilityState !== 'hidden'
    setPlaybackAllowed(allowed)
    setRewardPlaybackAllowed(allowed)
  }
  const setBlocked = (reason: string, value: boolean): void => {
    if (value) blocked.add(reason)
    else blocked.delete(reason)
    update()
  }
  const focus = (focused: boolean): void => {
    if (focused) blocked.delete('closing')
    setBlocked('focus', !focused)
  }
  const onFocus = (): void => focus(true)
  const onBlur = (): void => focus(false)
  // A real interaction with a visible webview proves focus even when WebKit
  // omitted its focus event after returning from an external sign-in browser.
  // Keep visibility, page and native-suspension blockers independent.
  const activate = (event: Event): void => {
    if (event.isTrusted && document.visibilityState === 'visible') focus(true)
    unlockRewardAudio()
  }
  const visibility = (): void => setBlocked('visibility', document.visibilityState === 'hidden')
  const pageHide = (): void => setBlocked('page', true)
  const close = (): void => setBlocked('closing', true)
  const pageShow = (): void => {
    focus(document.hasFocus())
    visibility()
    setBlocked('closing', false)
    setBlocked('page', false)
  }
  focus(document.hasFocus())
  visibility()
  // Touch activation occurs on release; pointerdown only activates mouse input.
  window.addEventListener('pointerdown', activate, true)
  window.addEventListener('pointerup', activate, true)
  window.addEventListener('touchend', activate, true)
  window.addEventListener('keydown', activate, true)
  window.addEventListener('focus', onFocus)
  window.addEventListener('blur', onBlur)
  window.addEventListener('pagehide', pageHide)
  window.addEventListener('pageshow', pageShow)
  window.addEventListener('beforeunload', close)
  document.addEventListener('visibilitychange', visibility)
  return {
    focus,
    suspend: () => setBlocked('suspended', true),
    resume: () => setBlocked('suspended', false),
    close,
    dispose: () => {
      window.removeEventListener('pointerdown', activate, true)
      window.removeEventListener('pointerup', activate, true)
      window.removeEventListener('touchend', activate, true)
      window.removeEventListener('keydown', activate, true)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('pagehide', pageHide)
      window.removeEventListener('pageshow', pageShow)
      window.removeEventListener('beforeunload', close)
      document.removeEventListener('visibilitychange', visibility)
      setPlaybackAllowed(false)
      setRewardPlaybackAllowed(false)
    },
  }
}

export async function installNativePlaybackLifecycle(lifecycle: PlaybackLifecycle): Promise<() => void> {
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  const { TauriEvent } = await import('@tauri-apps/api/event')
  const appWindow = getCurrentWindow()
  const listeners = await Promise.all([
    // No close-request listener, in any form: while the page listens for one, Tauri
    // holds the close and waits for the page to destroy the window, so the window
    // cannot be closed. Closing ends playback through `beforeunload` instead.
    appWindow.onFocusChanged(event => lifecycle.focus(event.payload)),
    appWindow.listen(TauriEvent.WINDOW_SUSPENDED, lifecycle.suspend),
    appWindow.listen(TauriEvent.WINDOW_RESUMED, lifecycle.resume),
  ])
  return () => { listeners.forEach(unlisten => unlisten()); lifecycle.dispose() }
}
