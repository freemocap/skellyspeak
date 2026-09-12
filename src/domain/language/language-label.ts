/// A language named in its own script, followed by its name in the learner's
/// language: "中文 (Chinese)". A language whose two names are the same is named once.
export function languageLabel(language: { name: string; endonym: string }): string {
  return language.endonym === language.name ? language.name : `${language.endonym} (${language.name})`
}
