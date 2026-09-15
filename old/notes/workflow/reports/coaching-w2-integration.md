# Wave 2 integration handback

Status: source implemented and reviewed; combined automated gate passed. Live provider and expert linguistic verification remain incomplete.

Base: bdb664e (user checkpoint: coach pass - wave 1). Implementation authorized by the user's instruction to continue. Existing .idea/modules.xml changes are unrelated and remain untouched.

## Acceptance

Implement coaching-plan sections 4–6, 8–10 per coaching-work-plan wave 2. The learner can choose their own conversation purpose, keep composing without completing a start panel, receive a hint before an answer, inspect evidence and keep going freely. The partner never becomes an examiner. Configuration is readable and validated; startup failure is explicit. Wave-three estimator, fluency, reward calibration and AI-generated openers remain future work.

Integration relays dependencies and reviews source, generated contracts and combined verification. No Git writes. Development SkellySpeak data is disposable; no compatibility/migration/backup work. No paid inference until integration declares the model and total request bound. Do not listen for Tauri close requests. Errors reach the UI, no fake production data or silent fallback. Research citations use existing bibliography keys; new claims require entries with url, review and claim. Language content remains needs_review.

## Assignments and ownership

- A: config/**, schemas/**, references.bib, src-tauri/src/languages.rs (or languages/**), new src-tauri/src/config/**, adapter language guidance and its snapshots, language citation tests. Also owns Cargo.toml/Cargo.lock for loader/schema/hash dependencies, and lib.rs only for config module registration (coordinate with B). Provide an early typed real API seam and complete the loader before final verification.
- B: core files from work-plan, new core modules, generated contracts.ts, bin/export-contracts.rs, schema SQL. May edit lib.rs startup/command registration after coordinating A's config declaration. Additionally owns bounded persona.rs, persona_prompt.rs, generation.rs and gloss.rs validation changes so runtime custom languages use the Store registry; lib.rs startup/commands remain B-owned. Owns assets/skill-catalogs/catalog.json only if a generated compatibility projection is required by existing presentation; source of truth must be YAML, no parallel authored catalog. Communicate concrete needed frontend consumer changes to C via integration.
- C: frontend surfaces, state, styles, UI and tests, plus src/types.ts, domain/skills/**, domain/language/conversation-view.ts/tests, platform/ipc/** and frontend App startup error handling. C additionally owns src/main.tsx and StartupRefusal/tests: refusal occurs before App mounts, and config errors must not offer database deletion. Does not edit generated contracts or authored config/catalog.
- Integration: plans, contracts, design/model/surface documentation and this wave's reports. Only assigns additional source ownership by a concrete relay.

## Sequencing

A publishes resolver/construct/policy/starter types and initialization API first. B publishes generated start/coach/retry/provenance contracts before C wires actions. C may build tested presentation while those contracts settle, but no mock-only production path is accepted. All coordination passes through integration.

Each domain returns workflow/reports/coaching-w2-{a,b,c}-handback.md with done/files/tests, incomplete work, verification failures, paid requests, contract drift, change requests, read vs inferred findings. Domain agents run focused checks; integration runs the complete shared gate once stable and reconciles failures. Source verification does not establish linguistic validity or native-device behavior.

## Review cases

- Loader: fresh bundled seed; existing valid local edits; malformed YAML; unknown keys and references; missing required files; cycles; unknown bibliography sources; review status cannot outrun evidence; deterministic hashes; changed content changes provenance. A second workspace must never silently inherit a different workspace's initialized config.
- Coach: exact nonempty source quotes, unique candidate IDs, at most six returned items, explicit counts; uncertain/absent means no update; developmental/slip skip and focus/meaning-blocking policy; at most one correction; target answer hidden until native reveal; durable rung/max-revision handling; continuing never blocked.
- Revision check: exact predecessor item and actually shown support, successful/unsuccessful repair, invalid quote/id rejection, repeat repair, late result after deletion/revision, no repair note or credit for an unchecked revision.
- Starts: usable composer without a card, deterministic local choices with honest reasons and selected-language content; partner-first no user row/credit; described assistance provenance; stale/nonempty/pending start rejection and duplicate receipt replay; first-response suggestions; source deletion and restart.
- UI: real native command handlers, failed/stale action keeps draft and exposes error; safe observation projection with no hidden answer; keyboard/touch and narrow/RTL; startup config refusal before store projections, no destructive reset remedy.
- Integration: all generated consumers updated, no numerically graded message UI left behind, no parallel authored catalog, no hash-mismatch evidence silently discarded. Source tests, visual checks, native operation tests and model validity remain distinct.

## In-progress review findings and resolved contracts

- Registry ownership changed from the proposed global initializer to one Registry owned by each Store. This avoids silently serving one workspace's config to another. Bundled constructors are explicit for contract export and standalone tests; runtime snapshots and prompts must use the Store registry.
- A dependency-fetch escalation stalled before the type scaffold was written. Integration resumed the agent with smaller handoffs and completed `cargo fetch`; serde_yaml_ng and its parser dependency are now available. This is tooling recovery, not an application fallback.
- Observation error data now includes explanation-language elicitation/metalinguistic cues in the original response, so rung selection stays local without English-only fallback or an extra inference call. Hypotheses and raw error rationales are not ordinary frontend observation data.
- An explicit answer is the terminal rung; a later unsuccessful manual revision must not index past the ladder. Uncertain repair evidence produces an unconfirmed state, not fabricated error or Fixed credit.
- Startup config correction requires quitting and reopening the native app. A web-only Reload button cannot rerun native initialization, so the config error screen gives the actual recovery instruction.
- Production GuidedPage test-transport visual inspection found pale starter buttons on the paper surface, empty-chat bottom scrolling, and an inline Fixed note overlapping Analysis. C owns the fixes; final visual status remains pending the last recheck. This fixture has no provider or native persistence side effects.

- Fresh schema v14 adds durable conversation opening ownership. Schema v13 is the previous checkpoint; tests must explicitly refuse it without migration or automatic erasure. No actual development data reset has occurred during this wave yet.

## Combined verification so far

Integration ran the full frontend gate: 87 files / 546 tests passed, production build passed and styles passed. The existing Vite bundle-size advisory remains. A later single-test extension verifies globally paused message-free openings; it passed separately and will be included in the final frontend run after generated catalog export. Documentation gate passed 28 docs tests, 7 parser-security tests and production docs build; the existing notifier permission notice appeared after success.

A's final focused checks passed 10 config, 4 languages and 21 adapter tests, including schema drift. C's handback and follow-up are on disk. Native combined gate remains pending B lifecycle tests. No live inference or application data reset has occurred.


## Final integration review additions

Read-only cross-review found scoped guidance gaps in partner pragmatics/persona generation and missing saved explanation-language validation. B owns the fixes and focused tests. Contact interest matching will normalize case/whitespace for exact tags, without pretending semantic classification exists.

A selected correction is not proof the learner saw it. The frontend's card and editing-banner routes previously made this distinction ambiguous. `open_card` now records native disclosure before showing the correction; `exposedMove` starts null and resets for each new rung. Pencil editing alone must not reveal an unrequested hint. Retry support derives exclusively from actual recorded exposure, while the selected correction remains available for checking the repair target. Show answer records explicit support. This is an evidence/provenance correction, not new reward calibration.


## Final combined gate — 2026-09-12 local time

- **551 frontend tests in 88 files passed**, including final durable-disclosure and global-pause cases. TypeScript/production build and stylesheet checks passed. Existing Vite bundle-size advisory remains.
- **285 native library tests passed**. Formatting, strict Clippy for library/tests, generated TypeScript/contracts and YAML-derived catalog checks, and native binary build passed. This includes the final saved-explanation-language regression added after B's earlier 284-test gate.
- **28 documentation tests and 7 parser-security tests passed**; production documentation build passed. The existing update-notifier permission notice occurs after successful compilation.
- A, B and C handbacks are `coaching-w2-a-handback.md`, `coaching-w2-b-handback.md` and `coaching-w2-c-handback.md`. Earlier counts in this report describe intermediate runs and are superseded here.

The source implements learner-selected starters and real partner openings, readable local YAML and per-workspace hashing, safe per-construct observations, deterministic graduated coaching, durable help disclosure and checked repair. Revisions retain the existing source invalidation/concurrency guarantees. There are no message-level numerical grades or new proficiency claims.

## Scope limits and next work

The migrated catalog's mandatory function/interaction criteria still exceed the target 15–25 candidates; they are preserved rather than silently truncated. Optional literal-token/trait retrieval is not a UD parser. Linguistic content and starter translations remain needs_review; literal answer-leak checks cannot prove semantic hint quality.

Wave three remains unimplemented: learner-state fold and review scheduling, fluency, richer support-weighted XP/reward tiers, generated coach-openers and session review. The user performs a Git checkpoint before that wave. No Git writes were made; the unrelated .idea/modules.xml edit was left untouched.


## Native startup and actual development reset

The signed current-checkout app built, passed signature verification and launched.
The first run read the existing schema-13 development database and returned the
expected startup refusal. Native UI automation could not inspect its window because
the Mac was locked and automatic unlock failed. No live-provider behavior is claimed.

Under the user's existing disposable-data authorization, integration stopped the
launcher and removed only `skellyspeak.sqlite3` (no sidecars existed) while holding
the same stable workspace lock through Rust File::try_lock. It validated the exact
application-data directory and regular-file types before removal. Configuration,
source files, Git history and unrelated application data were not deleted. This
was a scoped development database reset, not a factory reset or migration.

The second signed launch remains running. Run logs:
`.local/logs/app-2026-09-13T01-17-25.357Z-25e3320a-5bbd-470d-b8e1-ab064d37c000`.
Every fresh log stream was inspected. Diagnostics recorded registry load,
application mount and 17 successful IPC calls, with no recorded warning/error
events. Read-only inspection confirms schema14, zero turns and zero learner
messages. Actual provider requests during this wave: **0**.

Ready to inspect: wave-two source, generated contracts/catalog, configuration and
the signed fresh development app. Desktop/narrow browser UI checks used production
components with a test transport; interactive native and expert/live linguistic
validation remain incomplete. The Mac must be unlocked for native window inspection.

### Arabic-script gloss follow-up

Fixed the rendering split between morphological analysis and orthographic words.
Analysis sentence views now use the original learner/persona source, without
inserting guessed spaces between semantic tokens. Saved glosses and Arabic token
views group overlapping Arabic-script word ranges into a single source text node;
marks, joining controls and uncovered letters stay inside that shaping run.
Click/keyboard disclosure retains each part's original UTF-16 anchor and labels
its gloss with its source fragment. Evidence decoration and XP badges sit outside
the whole word, so neither can break a joining boundary. No stored schema or
linguistic segmentation was changed.

Browser fixture inspection confirmed joined words before and after disclosure and
with automatically visible glosses. Native-device and narrow-width checks for
this follow-up remain unverified. No provider call or Git write was made.

Follow-up verification: 557 frontend tests across 89 files passed; production
build, stylesheet checks and `git diff --check` passed. The existing Vite bundle
size advisory remains. Native code and contracts were unchanged by this fix.

### First-screen simplification requested during user testing

Replaced the starter cards, explanations, duplicate phrase tray and described-start
form with one “You start” button and an optional “Any topic” select. The default
uses the existing native surprise opening; choosing a topic uses its native starter
ID. Selecting a topic never starts automatically, and typing/recording remains
available. The native described-start contract remains implemented but has no
first-screen entry point. This supersedes the earlier wave-two first-screen UI.

Verified the actual GuidedPage in a browser fixture visually. 556 frontend tests,
production build and stylesheet checks pass. Updated integration tests exercise
the single-button default, topic selection, native failure and usable composer.

### Live feedback rejection follow-up

The desktop attempt at 2026-09-13T01:38:17.775Z failed with “Coach observation
rejected: empty or oversized text.” The rejected response was not retained, so
its exact offending field cannot be established retrospectively. Found and fixed
a contract mismatch: generated text fields lacked the validator's length bounds.
The schema now carries nonempty/maximum constraints, the prompt spells out null
error objects and omission of unquotable placeholders, and local rejection names
the field without echoing private output. Quote bounds also match the existing
shared prose validator's effective 12,000-character limit. Prompt version bumped.
287 native tests, strict Clippy, formatting and generated-contract checks pass.
Live-model confirmation remains pending a fresh request; no past failure is
relabelled as success. A separate word-gloss termination rejection was observed
in the same conversation and has not been diagnosed by this change.

### Real-app automation gap and new runner — 2026-09-13

User testing exposed that passing component/native tests did not establish live UI
workflow correctness. Added a checked-in Android CDP runner that drives the real
installed app, with no mocked IPC/provider responses: three language starts,
text sends, feedback/gloss checks, Arabic shaping assertion and optional synthetic
speech through MediaRecorder/native transcription/live inference. Artifacts and
errors are local per-run files. Tests never silently skip inaccessible devices.
See scripts/e2e/README.md for commands, credentials precondition and limits.

Verified: runner TypeScript check, device-selection failure test, generated speech
fixtures (es 2.01s, ar 2.02s, zh 2.59s; all nonempty PCM), diff whitespace check.
Actual preflight failed because ADB reported zero connected devices; desktop CUA
also reported a locked Mac. No live scenario or voice-injection success is claimed.
This is new automation awaiting device validation, not completed end-to-end proof.
No provider requests were made by this runner during this implementation turn.

### Learner analysis repair after v0 comparison

Read the archived v0 CoachEntry and EditFeedback for interaction principles only;
no archived code was copied or run. Found the regression: native summaries blanked
all rationales, and the UI displayed taxonomy/counters in a collapsed disclosure.
Non-error explanations now reach the UI; error rationales remain hidden until
explicit answer disclosure, which includes original/correction/reason. Analysis
has no nested observation details. Editing stays expanded with in-place help and
answer controls. Explicitly requested analysis can select a logged correction
that automatic interruption policy skipped. Added native disclosure regression
and UI explanation/correction tests. Updated persona prompt to prohibit first-person
echo/corrected-prefix responses and coach prompt to require concrete language help.
These prompt changes are not proof of model quality.

Offline gate: 558 frontend tests; 287 native tests plus the new focused requested-
analysis regression passed (288 total distinct passing tests). One opt-in live
regression remains ignored. Build, styles, strict Clippy and generated contracts
passed. Browser fixture reviewed with correction and explanation visible while
editing. Live cooking test was blocked by automatic approval review because it
would send the synthetic exchange to OpenRouter with local credentials. It did
not run; the reported phone exchange was not recovered or confirmed fixed.

### Private coach integration — 2026-09-13

Adopted the user's Cyrano/earpiece relationship in DESIGN.md, the coaching plan
and native coach instructions: practical assistance with the learner's own
intentions, preserving authorship. The latest exchange's coaching and language
analysis now appear automatically below the skill map. Detailed XP is collapsed.
Visible help records native exposure; hidden mobile or collapsed desktop panels
do not. Message feedback always opens the same dialog, with saved translation
and word meanings available even when no correction was selected. Actions now
flow after expanding bubble content. Suggested replies start collapsed behind
“Show suggested replies” and generation requires that explicit request. Native
requests are idempotent; automatic send no longer schedules suggestions.

Verified: 562 frontend tests across 91 files; 289 native tests passed with one
opt-in live test ignored. Strict Clippy, generated contracts, production build
and styles passed. Browser inspection used actual GuidedPage with a deterministic
test transport; latest coach content and collapsed suggestions were visible.
Restarted the signed desktop development app with updated native code; startup
diagnostics confirm successful workspace/settings/evidence IPC. No new provider
request was made for this verification. Partner response naturalness remains
unverified against a live model; the earlier approval-review block still applies.
Wave 2 changes remain uncommitted; this is not a Wave 3 completion claim.

### Coaching density and saved text reuse — 2026-09-13

Replaced the feedback dialog's vertical definition list and the analysis pane's
duplicated token lists with AnalysisSentence, which reuses SavedGlossText and
AnnotatedText. Saved source text, anchors, click-to-reveal help and Arabic joining
remain intact. Removed duplicate source text in the feedback dialog. Blue learner
and green partner blocks distinguish the exchange; amber cues distinguish help.
Tightened coaching padding, blockquote margins and analysis spacing. Removed the
learner bubble's whole-row edit gutter and made Translate/Analysis ordering match.
Browser fixture inspected with real saved word data and expanded translations,
then the feedback dialog. No provider requests or phone testing in this pass.
562 existing frontend tests passed; the added Arabic analysis-sentence test passed
after fixing its ambiguous assertion (563 distinct passing tests). Production
build and styles checks passed. Native code is unchanged by this visual pass.

### Direct coaching and partner reactions — 2026-09-13

Screenshot failure is a rejected empty evidence quote. Exact-source validation
remains intact; strengthened omission instructions and added explicit bounded
Retry failed help. No claim that prompt changes guarantee future valid output.
Coaching now explicitly addresses you, prohibits third-person assessment prose,
and requests one or two practical sentences. Existing saved text is unchanged.
Yellow accents distinguish help and feedback controls.

Found the reaction presentation and sound existed without a native producer. Added
a dependent coach_reaction operation reading the actual learner message and partner
reply, bounded structured validation, source-linked snapshot projection, and the
clickable emoji explanation. This costs one additional helper generation per new
exchange. No retroactive requests for old exchanges. Happy/sad/angry join existing
understood/confused/curious/surprised/concerned possibilities. Treat all as tentative
interpretations. Stable content comparison prevents sound replay on snapshot refresh.

Verification: 289 native tests pass, plus the focused reaction pipeline test (290
distinct passing); the live-provider test remains ignored. Frontend suite, build,
styles and strict Clippy checked. Restarted desktop with new native executable.
Wave 2 remains in stabilization, uncommitted; Wave 3 has not begun.
