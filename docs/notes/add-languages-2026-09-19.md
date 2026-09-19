# Add languages

Status: source implemented and verified on 2026-09-19; ready for user review.
The user accepted implementing language selection first. Android packaging remains
explicitly deferred. Onboarding will be a separate UX/UI design pass, followed by
implementation after its flow is settled.

## Implemented behavior

- The target-language picker contains saved My languages plus the active language,
  followed by Add language…. The adjacent My languages button opens management.
- The existing language browser now supports All languages / My languages and
  search across localized names, English names, endonyms and identifiers.
- Add language persists a learner shortcut and preferred variety. It does not
  switch, create or delete conversations or invoke AI. The active language is also
  retained when adding a second language. Existing learners initially see their
  active language; all earlier conversations remain accessible through history.
- Use now is a separate action that opens/selects the language conversation and
  applies the selected variety. New conversations use saved variety preferences.
- Remove from My languages removes only the shortcut and preserves remembered
  variety, conversations and progress. The current language cannot be removed
  through this control until the learner switches away. Opening an older chat
  always makes its active language visible in the picker.
- Learner preferences own the validated persistent list. Unknown and duplicate
  languages fail native validation. Writes retain revision checks; errors stay
  visible and the browser stays open. No browser-local storage owns real preferences.
- Technical language details remain available in an expandable section. The small
  mobile layout uses a bounded single-column list. The primary action receives
  focus after addition/removal. New labels are supplied in all seven UI locales.

This step does not implement downloads, change font coverage or add onboarding.
All current language definitions remain bundled. A font-resource manager can later
extend the Add action when a language actually requires downloadable assets.

## Verification

- Production UI build passed, including localization validation. Vite still emits
  its existing large-chunk advisory; bundle splitting was not part of this work.
- Final full UI suite: 792 tests passed in 124 files.
- Native suite: 427 passed, one existing ignored test. Initial sandbox socket
  restrictions were resolved by running with loopback access; the unrestricted
  suite passed. Tests include persistent add/remove, unchanged conversations,
  invalid/duplicate language rejection and preserved variety choices.
- Generated contracts, styles and generated design-system CSS checked.
- New language preview type-checked independently. The aggregate previews check initially reported a stale ConversationStart
  interface. That separate maintenance follow-up is now resolved; see
  [preview repair](conversation-preview-repair-2026-09-19.md).
- Actual production controls inspected in the browser with sample state at desktop
  size and 390×844, including Arabic interface direction and dark mode. Verified
  adding without switching and the visible success state. This is a frontend
  preview; native persistence is verified by tests, not an end-to-end device run.

## Ready to inspect

Run npm run dev, then open http://127.0.0.1:1420/tools/languages-preview.html.
It uses production picker/browser components with explicitly labeled in-memory
sample state; refreshing resets the sample. No native data or AI is touched.
A rebuilt native application uses the durable implementation.

No version bump, push, deployment or user-data reset performed. The feature and
related audit notes are being checked in together; untracked src-tauri build
leftovers are excluded.


## Design-system alignment review

Reviewed the [visual vocabulary notes](style-guide/README.md),
[adopted refactor decisions](style-system-refactor.md), and newer
[production design system](../design-system/README.md). The standalone notes
explorer is a proposal; production controls and CSS remain the implementation basis.

This surface uses existing DetailDialog, .btn variants, .field, .field-note,
and .panel-tabs / .panel-tab controls. Removed the initially added filter-button
selected-state styling and custom hint typography. The two list views now use
shared panel-tab styling with selection, focus and keyboard behavior. Feature CSS
owns only language-browser composition. The review fixture imports those same
production components and CSS; it defines no separate visual system.

Onboarding design will start from these production patterns and the existing
style/detail explorers, with any proposed new patterns explicitly identified
for review before implementation.


## Closeout: keep shared learning content out of language inspection

Removed shared goals and topics from both LanguageInspection and its rendered
sections. The language browser no longer labels the universal goal catalog as
language-specific. Removed the now-unused inspection types and goal-list styles;
generated contracts and design-system CSS are current. Shared learning YAMLs,
learner evidence and language-specific goal_material remain unchanged.

Final build, 792 UI tests, 427 native tests (one existing ignored), contract check,
style check and generated design-system check pass. A regression checks that
language inspection has no goals/topics fields and retains local learning material.

The signed native development bundle built, signature verification passed, and
the launcher started successfully. Native UI walkthrough is currently blocked by
the locked Mac; the user was asked to unlock it. Do not treat the earlier browser
fixture or successful launch as a completed native add/use/remove walkthrough.
