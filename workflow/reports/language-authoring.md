# Adding a language

The shipped catalog now contains English, Spanish, French, Arabic, Mandarin,
Portuguese and German. Every language is selectable as a learning language and
as the native/explanation language. Portuguese currently defaults to Brazil
(`pt-BR`); German defaults to Germany (`de-DE`). These are authored defaults,
not claims of evaluated model, transcription or pronunciation quality.

## Data checklist

1. Add `config/languages/languages/<id>.yaml`, using an existing language as the
   shape reference and `schemas/language.json` as the contract. Supply names,
   script, orthography, family, romanization, varieties, default variety, review
   status and a complete `starter_persona`. Reference existing shared records
   where appropriate. Add new script/orthography/trait records only when needed.
2. Add the language to the appropriate starter topics in
   `config/starters/everyday.yaml`: eligibility, localized label/preview and
   translations. Add its explanations to `config/starters/reasons.yaml`.
   Native validation checks coverage and references across the catalog.
3. Add `src/domain/language/i18n/locales/<id>.json`. English defines the message
   keys. Translate every message, including every explicit plural category,
   preserving interpolation names. Add the configured language name as a message
   in **every** dictionary, including English. IDs currently also identify Intl
   formatting locales, so use an Intl-supported locale ID; a future custom app ID
   needs a separate explicit formatting-locale field rather than guessed mapping.
4. Run `npm run languages:check`, then the README verification commands. The
   authoring check rejects missing/extra keys, duplicate JSON properties, broken
   placeholders, incomplete plurals, missing locales and untranslated static JSX.
   Dynamic authored content still requires review; this scan is not a translation
   quality assessment.
5. Inspect both language roles, switching native language with a draft present,
   new-chat persona creation, starter selection, difficulty and variety controls,
   number/date formatting, desktop/narrow layouts and script direction. Evaluate
   live conversation, explanation, transcription and playback separately for each
   intended AI route. Record quality evidence before claiming evaluated support.

No Rust seed list, TypeScript import list, locale union or persona switch needs
editing. The build recursively bundles configuration (excluding hidden entries
and Markdown); Vite discovers locale JSON. Symlinks and duplicate bundled paths
fail. Required malformed configuration and missing messages fail explicitly.

## Workspace ownership

Bundled configuration seeds a workspace only when its entire configuration
directory is absent. Builds do not overwrite an existing user's editable config.
An older development workspace must receive the new language records and required
`starter_persona` fields, or be explicitly recreated/reset while its native app is
stopped. There is no migration or automatic repair. This change did not erase or
reseed the running development workspaces.

UI dictionaries are bundled application resources, not editable workspace YAML.
Adding a shipped language therefore requires rebuilding the app. Conversation
text, persona content, authored rubric labels and raw provider/native diagnostic
errors retain their source language. Pre-settings startup and the standalone
developer window use English; operating-system menus have their separate native
localization boundary. Fluent-speaker review remains outstanding for new copy.

## Verification of Portuguese and German

Source checks cover all 49 configured learning/explanation pairs, starter
coverage, default varieties and persona validation, plus workspace persona
ownership. The React regression switches German to Portuguese without losing a
local draft. Browser fixtures of the actual components were visually inspected
in German/light, Portuguese/narrow/dark and Arabic/narrow/RTL. These were isolated
component fixtures, not restarted native sessions or live provider tests.

Frontend: 605 tests passed. Native: 325 passed, one ignored. Production build,
contract drift check, stylesheet check, iOS tooling checks, Rust formatting and
Clippy passed. The production build reports its large-chunk advisory: eager UI
dictionaries contribute to a roughly 932 kB main JavaScript chunk (300 kB gzip).
Locale lazy-loading is a future performance improvement, not a required language
registration step.
