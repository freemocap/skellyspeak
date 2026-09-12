// App UI localization. The NATIVE language doubles as the UI language:
// buttons, labels, and chrome render in the learner's own language, while
// the TARGET language drives the AI conversation and analysis.
//
// Dictionary-based (no i18n framework): flat keys, en as the source of
// truth, fr/es/ar/zh translations alongside. t() interpolates {vars} and
// falls back to English when a key is missing.


import type { Dict } from './dict'
import { en } from './locales/en'
import { fr } from './locales/fr'
import { es } from './locales/es'
import { ar } from './locales/ar'
import { zh } from './locales/zh'
export type UiLang = 'en' | 'fr' | 'es' | 'ar' | 'zh'

export function uiLangFromNative(native: string | null | undefined): UiLang {
  const base = (native ?? 'en').split('-')[0].toLowerCase()
  return base === 'fr' || base === 'es' || base === 'ar' || base === 'zh'
    ? (base as UiLang)
    : 'en'
}



export const LOCALES: Record<UiLang, Dict> = { en, fr, es, ar, zh }

/// Like t(), but falls back to `fallback` when the key is missing in every
/// locale — used for registry-driven labels whose English text lives at the
/// call site.
export function tOr(lang: UiLang, key: string, fallback: string): string {
  const dict = LOCALES[lang] ?? en
  return dict[key] ?? en[key] ?? fallback
}

export function t(lang: UiLang, key: string, vars?: Record<string, string | number>): string {
  const dict = LOCALES[lang] ?? en
  let out = dict[key] ?? en[key] ?? key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.split(`{${k}}`).join(String(v))
    }
  }
  return out
}
