import { useCallback } from 'react'
import { isTauri } from '../../platform/ipc/tauri'
import { useNavigationStore } from '../../state/navigation'
import { useSettingsStore } from '../../state/settings'
import { useReloadShortcut } from './useReloadShortcut'
import { useSettingsShortcut } from './useSettingsShortcut'
import { useTextSizeShortcut } from './useTextSizeShortcut'
import type { Shortcuts } from '../../types'

/// Every keyboard and menu shortcut the shell owns, in one place.
///
/// The binding comes in rather than being read here: the shell reads settings
/// once, before the first render when startup has already loaded them, and this
/// must not become a second reader racing that one.
export function useAppShortcuts(shortcuts: Shortcuts): void {
  const savingLanguage = useSettingsStore((state) => state.savingLanguage)
  const changeTextSize = useSettingsStore((state) => state.changeTextSize)
  const settingsBusy = useNavigationStore((state) => state.settingsBusy)
  // A language write is in flight, so the modal must not open over it.
  const toggleSettings = useCallback(() => { useNavigationStore.getState().toggleOverlay('settings') }, [])
  useSettingsShortcut({ enabled: isTauri && !savingLanguage, shortcut: shortcuts.settings, busy: settingsBusy, onToggle: toggleSettings })
  useTextSizeShortcut(changeTextSize)
  useReloadShortcut()
}
