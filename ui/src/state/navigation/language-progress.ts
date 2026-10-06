import { languages } from '../../platform/ipc/tauri'
import { reportFault } from '../../platform/diagnostics/faults'
import { useSettingsStore } from '../settings/settings'
import { useNavigationStore, type ProgressTab } from './navigation'

/// Open the Progress page for `target` at `tab`. Another language becomes the
/// active one first, with the variety last used for it (or its default), the
/// same switch the language picker makes; the page then shows its evidence.
/// A failed switch is reported in the fault bar and the page is not opened.
export async function openLanguageProgress(target: string, tab: ProgressTab): Promise<void> {
  const settings = useSettingsStore.getState().settings
  if (!settings) throw new Error('Settings are not loaded.')
  try {
    if (settings.target_language !== target) {
      const definition = languages().find(language => language.code === target)
      if (!definition) throw new Error(`Unknown language: ${target}`)
      await useSettingsStore.getState().selectLanguageVariety(target, settings.target_varieties[target] ?? definition.defaultVariety)
    }
    useNavigationStore.getState().openProgress(tab)
  } catch (error) {
    reportFault('Switching language', error)
  }
}
