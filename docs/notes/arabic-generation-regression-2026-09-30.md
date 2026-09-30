# Arabic generation regression investigation — 2026-09-30

Status: sparse generated marking confirmed; triggering change not established. The initial investigation was read-only. A subsequent requested content pass is recorded below.

## Verified observations

- Compared release baseline `ae269198` (September 27) with `74aca104` (current committed checkout), and separately inspected relevant working-tree changes. The checkout contains substantial unrelated work, preserved unchanged.
- No committed differences in that interval in `content/`, language-context resolution, the conversation or private-coach prompt builders, Drill generation prompts, text transports, connection/model selection, or server inference code.
- Full vocalization was introduced by `99bddf88` on September 20. The September 25 reformat in `ea477bc0` preserved the instruction. Both target-writing and explanation-writing scopes still request full vowel marks at every difficulty, with exact quotations exempted.
- Read-only inspection of the local workspace found two Arabic assistant records on September 30: one partner opening and one private-coach response. Both actual attempt request-message records contain the full-vowel instruction. Each attempt response is byte-for-byte identical to its saved message. Marks are already sparse before display.
- The partner opening has 6 Unicode marks and 46 letters. The coach response has 8 marks and 284 letters across its mixed-language response. These are diagnostic counts, not Arabic-only linguistic scores or judgments of correct vocalization.
- The partner opening predates the uncommitted conversation continuity update: it records prompt version 38, while the later coach response records version 39. Today's continuity edit therefore cannot explain the already-sparse opening.
- Ordinary prose validation checks empty text, length and NUL characters; it does not check whether requested writing guidance was followed. Partial marking can therefore be accepted normally.

## Recent changes worth isolating

1. `d16874e0`, September 29 at 13:03 EDT: `ConversationDirection::default` changed from no selected topic to Coach's choice. Existing recommendation assembly appends skill guidance after the ordinary prompt. The inspected sparse partner opening used this mode and included unvocalized Arabic terms in appended guidance. This changes the default input context and is a plausible priming influence, not a demonstrated cause. It does not by itself explain every generation surface.
2. `24a7016e`, September 28 at 18:03 EDT: explanation-card validation stopped requiring quotes to be literal substrings of their source. This can admit altered quote spelling, including changed marks, in explanation cards. It does not rewrite partner messages and cannot explain the sparse raw partner response.
3. Uncommitted practice phrase banks contain sparsely marked authored text. This is separate from live generation and is not evidence for the reported shared generation regression.

## Limits and next discriminating check

The available local workspace has no older Arabic assistant records to establish the last well-marked response or a transition date. Git establishes that the central writing instruction and request settings did not change in the requested interval; it does not establish that model behavior remained constant.

A controlled synthetic comparison should keep model, route, difficulty, variety and wording fixed while comparing the pre-September-29 default with the new appended skill context. Evaluate generated mark coverage and actual spelling, including multiple repetitions. If this does not reproduce a difference, compare known-good and failing captured requests and response metadata from the affected runtime. Do not present the default-mode change as the root cause without that evidence, or revert unrelated work speculatively.

Restoring reliable full marking and subsequently selecting a less dense policy are separate changes. The current declared policy already requests the former. Weakening it now would obscure the investigation.

## Verification performed

Git history and targeted diffs; current source-path inspection; read-only request/response and saved-message comparisons. No paid generation, application launch, build, deployment, data reset, or commit. No automated tests were run because this pass changed only this investigation note.

## Requested authored-content pass

Implemented after the investigation: reviewed the 39 skill examples, embedded Arabic
terms in skill guidance, 112 practice phrases across the two varieties, ten
romanization examples, and six topic labels. Added moderate reader-oriented marking
and reduced exhaustive marking in previously dense skill examples for consistency.
Some already clear words and an already marked romanization example needed no change.
The changes live in `content/languages/arabic.yaml` and
`content/shared/conversation-topics.yaml`.

Editorial approach: retain helpful short vowels and consonant doubling; use selective
sukun where it clarifies a consonant cluster; avoid exhaustive marking and routine
case endings in standalone phrases. Preserve distinguishing person vowels when
needed, and keep Levantine and standard forms separate. This is a content-editing
choice, not a new runtime policy or a claim of completed speaker review. Existing
`needs_review` statuses remain.

The generation instructions still request full marking, as explicitly requested for
this pass. Prompt prose, translations, base letters, phrase ordering, identity and
persona fields, and lexical matching hints were preserved. A comparison against a
pre-edit snapshot confirmed that only Unicode combining marks changed in the two
authored files. The resolved baseline fixture was updated only for the nine changed
romanization source spellings.

Verification: `npm run languages:check` passed, including all 51 configuration
tests; `npm run contracts:check` and targeted `git diff --check` passed. Native
`inspect-content --skill-prompt arabic arabic-levantine reasons_conditions` shows
the marked terms in the actual compact skill guidance. No live generation comparison
was run; improved output density remains an expectation to evaluate after rebuilding,
not a verified regression fix. Existing saved messages and practice cards were not
rewritten. No commit or deployment.
