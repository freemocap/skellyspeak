# Language variety switching audit — 2026-09-21

## Observed failure and implemented fix

Local frontend diagnostics recorded `The selected variety is unavailable` through
`languageFor → ReadingLanguageScope → LanguageDetails → LanguageBrowser`.
Switching a loaded browser selection rendered the previous inspection report with
the newly selected variety before the effect cleared the old report. This could
combine two different languages and crash the app's reading scope.

The browser now associates each response with its complete inspection request
(language, variety, explanation language, explanation variety and retry).
It only renders a matching response. LanguageDetails takes both language and
variety from that response. The existing cancellation guard ignores late responses
and failures. Configuration validation and rejection of invalid varieties remain.

## Audit and automated verification

All 12 language definitions and 16 varieties passed the production content loader.
The existing configuration suite checks references, defaults, duplicate IDs/YAML
keys, writing systems, romanization, provider mappings, bundled/disk equivalence,
and target/explanation variety combinations.

Added a permanent browser-report identity test driven by the bundled registry:
256 explicit target/explanation variety pairs plus 144 language-default pairs.
Each report preserves the requested language and variety, includes that variety
in its projected catalog, and carries the current content fingerprint. New
languages/varieties automatically enter this test.

Reviewed onboarding, target/explanation pickers, saved per-language preferences,
settings persistence and reading scopes. No additional configuration or switching
fault was identified in those paths.

Verification:

- `npm run languages:check`: passed; 31 configuration tests, all content and
  interface-localization checks passed.
- Related UI suites: 90 tests passed across language browser, language pickers,
  settings state, settings IPC and language membership.
- Browser regression coverage includes the original loaded-report crash,
  pending variety changes, stale responses, and late failures after switching back.
- The prior fix passed the frontend production build.

These are automated checks and source review, not a manual native-window sweep
or a linguistic-quality review of every language's prose. No language content
needed changing; no deployment or commit was performed.
