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
5. Inspect both language roles, switching interface locale and explanation variety with a draft present,
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

## Varieties: current architecture

Use **Language → Variety**. The catalog continues to show Arabic once; it now
contains `ar-levantine` (the default) and `ar-MSA`. Fine-grained Levantine coverage
is deliberately deferred. The shared term “variety” accommodates standard and
regional forms; it does not mean only accent. Coaching distinguishes a valid form
in another variety from an error. [@asha_language_variation]

A variety record requires `id`, `name`, `description`, `review`, `sources`,
`external_tags` and `guidance`. Its nullable `script`, `orthography` and
`romanization` references inherit the language values when null. A non-null value
replaces that reference. `romanization_disabled: true` explicitly disables
romanization and cannot coexist with a romanization override. Scalar overrides
remain optional. The resolved orthography must match the resolved script.
Guidance is additive in universal → trait → orthography → language → variety order;
authors must avoid contradictory instructions. Reviewed varieties require sources;
new records stay `needs_review` until their linguistic claims have been reviewed.

Add the variety's configured name to every bundled UI dictionary. The authoring
checker verifies these names alongside language names. Do not create another
locale dictionary for each variety. Descriptions are workspace-authored content,
not interface translations. The config validator checks all references and
language/variety relationships. There is no provider-specific switch to extend.

Internal IDs are not external locale tags. `external_tags` merges language defaults
with explicit variety overrides. The current `transcription` mapping must be a
two-letter language code because that is the supported audio transport contract.
Other mapping keys are retained metadata until an adapter explicitly consumes
them; their presence does not create a capability. [@rfc5646_language_tags]
Transcription receives the captured variety name as a prompt hint; synthesis
receives the captured language and variety names as descriptive instructions.
Neither guarantees exact dialect recognition, pronunciation or accent. Settings
exposes that limitation. Voice selection and register remain separate concepts.

### Ownership and defaults

- Learner preferences own `targetVarieties` (a map of language IDs to selected
  defaults), `explanationLanguage`, `explanationVarietyId` and `interfaceLocale`.
- Conversation settings own concrete `varietyId` and `explanationVarietyId`
  selections. New conversations use learner language defaults; unrelated practice
  settings still copy the contact's most recently opened conversation as before.
- Editing a conversation's language choices through Settings also updates the
  corresponding learner defaults. Display-only edits do not overwrite defaults.
  Opening an existing language's conversation preserves that conversation's choices.
- The optional explanation variety is independent of target variety and interface
  locale. Interface locale has its own Settings control. Language changes select
  a valid default for the new explanation language; a single available variety is
  displayed by name without requiring a choice.
- Resolved operation context includes both varieties, their guidance, target
  script/presentation, provider mappings and a fingerprint. Deferred work and
  retries retain captured context rather than reading later settings. Language
  progress still aggregates by language; retained operations preserve variety
  provenance. No separate variety proficiency score was introduced.

### Starter compatibility

`compatible_varieties` explicitly maps each starter's language to varieties its
fixed preview/translation supports. Selection checks **both** target and
explanation varieties. An incompatible starter is not offered or silently
rewritten. When none match, the snapshot remains usable and the UI says that no
matching topics are available. Learners can still compose or request an opening.
The existing Arabic starter text is marked MSA-only; Levantine starter authoring is
future content work. This does not prevent a Levantine conversation or a custom
lesson request.

### Verification and activation

Variety implementation checks cover independent English US/UK guidance fixtures,
script/romanization overrides, invalid references, default ownership, persistence,
immutable captured context, starter compatibility, provider request construction
and UI state preservation. The latest complete run passed 621 frontend tests and
343 native tests (one ignored); production build, contract drift, stylesheet, iOS tooling, Rust formatting and
Clippy checks passed. Vite retains its large-chunk advisory. German/light and Arabic/narrow/dark/RTL component fixtures were
visually inspected. These fixtures did not submit AI requests.

The development database is now schema **15**. Older databases are refused with
an explicit reset message; this change does not migrate or delete them. Existing
editable config needs the new metadata and starter compatibility fields or an
explicit recreation from the shipped seed. No running workspace was reset, no
provider quality evaluation was performed, and no application was deployed.
