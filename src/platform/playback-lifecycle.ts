import { setPlaybackAllowed } from './audio/speech'
import { setRewardPlaybackAllowed, unlockRewardAudio } from './audio/reward-sounds'

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
  window.addEventListener('pointerdown', unlockRewardAudio, true)
  window.addEventListener('pointerup', unlockRewardAudio, true)
  window.addEventListener('touchend', unlockRewardAudio, true)
  window.addEventListener('keydown', unlockRewardAudio, true)
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
      window.removeEventListener('pointerdown', unlockRewardAudio, true)
      window.removeEventListener('pointerup', unlockRewardAudio, true)
      window.removeEventListener('touchend', unlockRewardAudio, true)
      window.removeEventListener('keydown', unlockRewardAudio, true)
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
    appWindow.onFocusChanged(event => lifecycle.focus(event.payload)),
    appWindow.onCloseRequested(lifecycle.close),
    appWindow.listen(TauriEvent.WINDOW_SUSPENDED, lifecycle.suspend),
    appWindow.listen(TauriEvent.WINDOW_RESUMED, lifecycle.resume),
  ])
  return () => { listeners.forEach(unlisten => unlisten()); lifecycle.dispose() }
}
