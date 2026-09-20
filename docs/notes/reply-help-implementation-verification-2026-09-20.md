# Reply help implementation and verification

Status: implemented and verified in source on September 20, 2026, after checkpoint
`4465893` and the user's instruction to complete the
[integrated plan](reply-help-implementation-plan-2026-09-20.md). Changes are
uncommitted. No deployment, live provider request or user-workspace reset was run.
The earlier [audit](reply-help-plan-audit-2026-09-20.md) describes the starting tree.

## Completed behavior

- Normal and opening partner turns schedule only the brief automatically among
  the three reply-help jobs. Grammar and suggestions are independently requested
  on first deliberate disclosure. Mounting, fixture-open state, folding, reopening
  and reading saved results do not schedule generation.
- Brief, grammar and suggestions have separate persisted results, operation state,
  errors, diagnostic details and explicit retries. Zero grammar cards is success.
  Command acceptance remains pending until the durable snapshot advances; a newer
  snapshot supersedes a failed command response. Analysis uses the same grammar
  request and saved result for its selected message.
- Native requests require a published, available partner source. Existing
  operations are reused transactionally. Retries affect only the selected
  failed/unknown operation, with current access settings and captured turn context.
  Existing queue admission, holds, cancellation, response validation and publication
  machinery remain authoritative. Invalidated/replaced sources cannot publish late
  results. Provider request metadata and usage survive validation failure.
- Suggestions preserve the active `AssistedReply` shape: two replies with passage
  translation, romanization and pronunciation, plus two frames and two starters.
  Only insertion buttons append to the composer, with existing evidence provenance;
  reading actions neither insert nor send. Help does not award learning credit.
- ReplyHelp uses ReadingPassage, TargetText, MixedText, saved word annotations,
  shared lookup and shared speech. Whole-passage aids are not invented token glosses.
  Captured language/variety/explanation scope applies after preferences change;
  current reading preferences and script scales still control presentation.
- Shared word requests coalesce by scope and text. One consumer closing cannot
  cancel another; final-consumer cancellation prevents stale cache writes. Failures
  are not cached. The existing bounded cache and registrations reset with workspace
  session identity. No parallel suggestions dictionary or speech cache was added.
- Production-shaped Mandarin and Arabic fixtures exercise the real component.
  ReplyHelp has registered resting/grammar previews and a component README;
  generated contracts and the design-system stylesheet were regenerated.

## Data and ownership

Schema **26** deliberately replaces schema 25's automatic assistance graph.
Existing development data needs the established explicit reset workflow; this
change does not silently migrate or delete the user's workspace. New tests use
throwaway SQLite stores, including closing/reopening a store with retained help.

`conversations/execution/assistance.rs` owns request/retry eligibility;
`learning/coaching/conversation_support` owns typed output and prompts; store
commands retain the transaction and receipt boundary. Native operation views
provide `replyHelpKind`, avoiding a separate frontend operation-name catalog.
Partner snapshots provide captured `ReadingScope`. The UI projection lives in
`domain/conversation/reply-help.ts`, and feature composition stays in conversation.
No provider transport or hosted server API was forked for this feature.

## Verification results

| Check | Result |
| --- | --- |
| `npm test` | 995 tests passed across 152 files |
| `cargo test --manifest-path native/Cargo.toml --lib` | 460 passed, 2 ignored, no failures; local HTTP fixtures permitted |
| `cargo clippy --manifest-path native/Cargo.toml --lib --tests -- -D warnings` | Passed |
| `npm run build` | Passed; existing large-bundle advisory remains |
| `npm run previews:check` | Passed |
| `npm run contracts:check` | Passed |
| `npm run styles:check` | Passed |
| `npm run styles:dead` | Completed; 15 existing candidates, no newly introduced unused classes |
| `npm run design-system:check` | Passed |
| `npm run docs:links` | Passed |
| `git diff --check` | Passed |

New native coverage checks automatic scheduling on normal/opening turns,
transactional duplicate requests, saved empty grammar after store reopen, current
access binding, captured scope, independent retry, pause/hold, archive rejection,
cancellation/late publication and retained metadata on invalid output. Existing
execution/transport suites cover the shared routes, revisions, admission and
response machinery. UI coverage checks independent disclosures, enqueue/snapshot
separation, lost response reconciliation, result/error display, scoped retry,
insertion ownership, retained passage aids and reading-request concurrency.

Repository-wide `cargo fmt -- --check` still reports formatting differences in
seven untouched checkpoint files: `ai/audio.rs`, `ai/transport/provider/mod.rs`,
`ai/transport/speech_provider.rs`, `application/commands/local_server.rs`,
`configuration/mod.rs`, `conversations/conversation_prompt.rs` and
`storage/store/tests/preferences.rs` (all under `native/src/`). Changed Rust files
were formatted individually without recursively rewriting unrelated modules.

Small checkpoint hygiene repairs required for complete checks: stale Arabic
font-scale fixture expectations now match the shipped 1.0 configuration (explicit
1.8 override coverage remains); reading-command needless borrows were removed;
a cross-feature reading-preferences test moved from shared components to
`ui/tests/reading/`. Production language defaults were not changed.

## Visual and runtime limits

Browser inspection used the offline conversation and reading previews at 1280×900
and 380×850: independent/both disclosures, light/dark presentation, Arabic RTL,
shared word help, translation and insertion without send. The composer remained
reachable with help open. Narrow reading fixtures were corrected to stack rather
than squeeze into two columns. Screenshots were inspected during the session.
Temporary viewport overrides were reset.

This establishes production-component presentation and interaction, plus native
scheduling/persistence through executable tests. It is not a native desktop GUI
end-to-end run or a measurement of live model quality, latency or billing. Live
provider sampling and a packaged desktop smoke test remain verification follow-ups,
not missing implementation. No cost-saving percentage is claimed. Exhaustive
assistive-technology/device testing was not performed.

## Follow-up: collapsed help and desktop Coach placement

Implemented the user's subsequent request: help starts collapsed regardless of
saved/pending brief data and remains collapsed when data arrives. Desktop renders
one instance at the top of the Coach content area, using that area's scrolling;
mobile retains the bounded composer tray. The existing insertion callback still
appends to and focuses the conversation draft. Explicit preview `opened` states
remain supported without requesting AI work.

Verified 16 reply-help component tests, production build, preview type checking,
style validation and generated design-system check. Browser fixtures confirmed
collapsed/open help in the desktop Coach panel and at 380px above the mobile
composer. No native scheduling or data-contract changes were needed.

## Follow-up: mixed-script example regression and hover paint

The user reported `مَاذَا تَأْكُلُ؟ (mādhā ta’kulu?) – What are you eating?`
rendered as one RTL passage in the new grammar panel. This was an integration
regression: ReplyHelp called ReadingPassage directly, bypassing AnalysisContent's
existing explicit example splitter. Extracted ReadingExample and use it in both
surfaces. Explicit source/romanization/translation strings now get separate passage
aids; unstructured examples use MixedText and preserve their content without
assigning all prose the source script's typography. Added a regression through
ReplyHelp itself, including translation and romanization controls.

The screenshot also shows a dotted hover underline without its Arabic glyphs.
The existing DOM-preservation fix was still present; its jsdom test cannot detect
native glyph painting failures. Removed the shared hover text decoration in favor
of a background highlight that does not change text metrics. This targets the
observed paint symptom; a native WebKit root cause has not been established.

Verification: 97 tests in 14 reading/reply-help files passed; production build,
preview typecheck, styles, generated design-system and diff checks passed. Added
the exact reported example to the offline reading preview. Browser inspection
confirmed source, translation and romanization separated and final-word glyphs
visible with word help open. Native application hover painting remains unverified;
this browser result must not be presented as native-runtime confirmation.
