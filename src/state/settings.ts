import { create } from 'zustand'
import { applyFontSizeAction, type FontSizeAction } from '../domain/input/font-size'
import { uiLangFromNative } from '../domain/language/i18n'
import { reportFault } from '../platform/diagnostics/faults'
import { getSettings, languageFor, saveSettings } from '../platform/ipc/tauri'
import type { Settings } from '../types'

/// The preferences Rust owns, as one value with one writer.
///
/// One record, one writer: every surface reads this store and writes through it,
/// so two components cannot hold two views of a record only Rust may change.

export type PreferenceKey =
  | 'auto_speak' | 'auto_send' | 'always_romanize' | 'auto_translate'
  | 'always_pronunciation' | 'fast_mode' | 'tts_rate'

export type LanguageField = 'target_language' | 'native_language'

/// Mirror the native language onto the document: UI strings come from
/// `uiLangFromNative` (domain/language/i18n) and text direction from the
/// registry, so an Arabic native gets a right-to-left UI rather than just
/// Arabic words.
function applyUiLanguage(native: string): void {
  document.documentElement.dir = languageFor(native)?.direction ?? 'ltr'
  document.documentElement.lang = uiLangFromNative(native)
}

interface SettingsState {
  settings: Settings | null
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

  setLanguage: (field: LanguageField, value: string) => Promise<void>
  setPreference: (key: PreferenceKey, value?: number) => Promise<void>
  changeTextSize: (action: FontSizeAction) => void
}

const initialState = {
  settings: null as Settings | null,
  revision: 0,
  savingLanguage: false,
  savingPreference: false,
}

export const useSettingsStore = create<SettingsState>((set, get) => {
  /// Adopt a record Rust produced. `changed` is false for a plain read: the same
  /// record, described again.
  const adopt = (saved: Settings, changed: boolean) => {
    applyUiLanguage(saved.native_language)
    set((state) => ({ settings: saved, revision: changed ? state.revision + 1 : state.revision }))
  }
  const read = async (changed: boolean) => { adopt(await getSettings(), changed) }

  return {
    ...initialState,

    load: () => read(false),
    refresh: () => read(true),

    save: async (next, baseline) => {
      await saveSettings(next, baseline)
      const fresh = await getSettings()
      adopt(fresh, true)
      return fresh
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

    setLanguage: async (field, value) => {
      if (get().savingLanguage) return
      set({ savingLanguage: true })
      try {
        await get().update(current => ({ ...current, [field]: value, ...(field === 'target_language' ? { target_dialect: '' } : {}) }), 'Saving language')
      } finally {
        set({ savingLanguage: false })
      }
    },

    // The conversation's own reading preferences.
    setPreference: async (key, value) => {
      if (get().savingPreference) return
      set({ savingPreference: true })
      try {
        await get().update(current => ({ ...current, [key]: value ?? !current[key] }), 'Saving reading preference')
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
