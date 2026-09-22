import { saveMyLanguage, saveScriptScale } from '../../platform/ipc/my-languages'
import { languages } from '../../platform/ipc/tauri'
import { create } from 'zustand'
import { applyFontSizeAction, type FontSizeAction } from '../../domain/input/font-size'
import { browserLocale, UI_LOCALE_METADATA } from '../../domain/localization'
import { reportFault } from '../../platform/diagnostics/faults'
import { getSettings, saveSettings } from '../../platform/ipc/tauri'
import type { Settings } from '../../types'

/// The preferences Rust owns, as one value with one writer.
///
/// One record, one writer: every surface reads this store and writes through it,
/// so two components cannot hold two views of a record only Rust may change.

export type PreferenceKey =
  | 'auto_speak' | 'auto_send' | 'always_romanize' | 'auto_translate'
  | 'always_pronunciation' | 'fast_mode' | 'xp_effects' | 'tts_rate'

export type LanguageField = 'target_language' | 'native_language'

/// Mirror the native language onto the document: UI strings come from
/// `requireUiLocale` (domain/localization) and text direction from the
/// registry, so an Arabic native gets a right-to-left UI rather than just
/// Arabic words.
function applyUiLanguage(locale: string): void {
  const tag = browserLocale(locale)
  document.documentElement.dir = UI_LOCALE_METADATA[locale].direction
  document.documentElement.lang = tag
}

interface SettingsState {
  settings: Settings | null
  /** Identity of the latest projection read; reset with the public store state. */
  readRequest: { changed: boolean } | null
  /// Bumped when a **write** lands, never by a read. Callers use it as a reload
  /// key and as "a save has happened since mount", so a read must not look like
  /// one.
  revision: number
  /// A language write is in flight. Kept separate from the reading-preference
  /// flag because the two gate different controls; one shared flag would disable
  /// the language pickers while a reading toggle saved, and the reverse.
  savingLanguage: boolean
  /// A reading preference is in flight, for the same reason.
  savingPreference: boolean

  /// Read the record for the active conversation: at startup, and again whenever
  /// the active conversation changes.
  ///
  /// The record describes that conversation's scope. It carries the scope's
  /// conversation id and settings revision, and Rust refuses a write against a
  /// scope that has moved on — which is why a chat switch is a reason to re-read.
  /// A read is not a change: nothing was written, so the revision stays.
  load: () => Promise<void>

  /// Read again and count it as a change, because a surface other than this store
  /// wrote the record: AI access writes through its own commands.
  refresh: () => Promise<void>

  /// Write a draft and adopt what Rust reports. Returns that value so a caller
  /// holding a draft can merge edits typed while the write was in flight.
  save: (next: Settings, baseline: Settings) => Promise<Settings>

  /// Read, change, write: the one shape every preference edit takes.
  ///
  /// A fresh read is the baseline, because a cached copy would overwrite whatever
  /// else changed since it was read. `change` returns null when the edit would
  /// write what is already there. A failure is reported under `faultContext`
  /// rather than thrown, because every caller is a control the learner has
  /// already moved on from.
  update: (change: (current: Settings) => Settings | null, faultContext: string) => Promise<void>

  saveScriptScale: (language: string, scale: number | null) => Promise<void>
  saveMyLanguage: (language: string, variety: string | null) => Promise<void>
  selectLanguageVariety: (language: string, variety: string) => Promise<void>
  setLanguage: (field: LanguageField, value: string) => Promise<void>
  setPreference: (key: PreferenceKey, value?: number) => Promise<void>
  changeTextSize: (action: FontSizeAction) => void
}

const initialState = {
  settings: null as Settings | null,
  readRequest: null as { changed: boolean } | null,
  revision: 0,
  savingLanguage: false,
  savingPreference: false,
}

export const useSettingsStore = create<SettingsState>((set, get) => {
  /// Adopt a record Rust produced. `changed` is false for a plain read: the same
  /// record, described again.
  const adopt = (saved: Settings, changed: boolean) => {
    applyUiLanguage(saved.interface_locale)
    set((state) => ({ settings: saved, readRequest: null, revision: changed ? state.revision + 1 : state.revision }))
  }
  const read = async (changed: boolean): Promise<Settings> => {
    // A newer read inherits an unadopted write notification. It may replace
    // the projection, but must not lose the invalidation that write requires.
    const request = { changed: changed || get().readRequest?.changed === true }
    set({ readRequest: request })
    const fresh = await getSettings()
    if (get().readRequest === request) adopt(fresh, request.changed)
    return fresh
  }

  return {
    ...initialState,

    load: async () => { await read(false) },
    refresh: async () => { await read(true) },

    save: async (next, baseline) => {
      await saveSettings(next, baseline)
      return read(true)
    },

    update: async (change, faultContext) => {
      try {
        const current = await getSettings()
        const next = change(current)
        if (!next) return
        await saveSettings(next, current)
        await read(true)
      } catch (error) {
        reportFault(faultContext, error)
      }
    },

    saveScriptScale: async (language, scale) => {
      if (get().savingLanguage) throw new Error('A language change is already being saved.')
      set({ savingLanguage: true })
      try {
        await saveScriptScale(language, scale)
        await read(true)
      } finally { set({ savingLanguage: false }) }
    },

    saveMyLanguage: async (language, variety) => {
      if (get().savingLanguage) throw new Error('A language change is already being saved.')
      set({ savingLanguage: true })
      try {
        await saveMyLanguage(language, variety)
        await read(true)
      } finally { set({ savingLanguage: false }) }
    },

    // The browser explicitly chooses a variety after selecting its conversation.
    // Failures propagate to the browser; never claim success after a partial save.
    selectLanguageVariety: async (language, variety) => {
      if (get().savingLanguage) throw new Error('A language change is already being saved.')
      const definition = languages().find(item => item.code === language)
      if (!definition?.varieties.some(item => item.id === variety)) throw new Error('The selected variety is unavailable.')
      set({ savingLanguage: true })
      try {
        const current = await getSettings()
        const switched = current.target_language === language ? current : await get().save({ ...current, target_language: language, target_variety: definition.defaultVariety }, current)
        if (switched.target_variety !== variety) await get().save({ ...switched, target_variety: variety }, switched)
      } finally { set({ savingLanguage: false }) }
    },

    setLanguage: async (field, value) => {
      if (get().savingLanguage) return
      set({ savingLanguage: true })
      try {
        await get().update(current => ({ ...current, [field]: value, ...(field === 'native_language' ? { native_variety: languages().find(l => l.code === value)!.defaultVariety } : {}), ...(field === 'target_language' ? { target_variety: current.target_varieties[value] ?? languages().find(l => l.code === value)!.defaultVariety } : {}) }), 'Saving language')
      } finally {
        set({ savingLanguage: false })
      }
    },

    // The conversation's own reading preferences.
    setPreference: async (key, value) => {
      if (get().savingPreference) return
      set({ savingPreference: true })
      try {
        await get().update(current => ({ ...current, [key]: value ?? (key === 'xp_effects' ? current.xp_effects === false : !current[key]) }), 'Saving reading preference')
      } finally {
        set({ savingPreference: false })
      }
    },

    // Reading size is a learner preference, not transient WebView zoom. Both the
    // keyboard and the native View menu call this one path.
    changeTextSize: (action) => {
      void get().update(current => {
        const textSize = applyFontSizeAction(current.text_size, action)
        return textSize === current.text_size ? null : { ...current, text_size: textSize }
      }, 'Changing text size')
    },
  }
})
