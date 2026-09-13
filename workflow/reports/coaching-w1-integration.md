# Wave 1 integration handback

Base: `c740fe0` on main. Status: wave-one source implementation complete; domain handbacks reviewed and combined automated verification passed. Interactive native/provider verification remains incomplete. Agents made no Git writes. Existing uncommitted preparation documents are included in the reviewed working-tree baseline.

## Purpose and acceptance

This wave makes self-repair possible and connects learner-owned practice focus to natural conversation. Language guidance should be inspectable and explicit about what has been reviewed. A repair preserves the learner's earlier wording and shows what changed. The partner remains a conversation partner; focus should create opportunities without drilling or grading in the partner voice. Credit remains a transparent account of evidence and assistance. These requirements implement coaching-plan §1's Freire/hooks/Illich commitments; they do not add new research claims.

## Completed assignment scope

- A: `workflow/reports/coaching-w1-agent-a.md`. Start with primary-table verification, the two guidance APIs, punctuation and citation tests. Return exact guidance text and API tests first.
- B: `workflow/reports/coaching-w1-agent-b.md`. Start with the generated revision identity/action/snapshot proposal, focus capture, five outcomes and catalog consistency. Follow the updated Revision integration requirements. Return concrete field names, concurrency/removal scope and credit test evidence before C wires the action.
- C: `workflow/reports/coaching-w1-agent-c.md`. Start with revision presentation fixtures and GuidedPage integration coverage. Wire only after B generates the real contract. Keep fixtures in tests; no substitute production behavior.

The work plan now explicitly assigns C the skill consumers, presentation types and conversation adapter, reserves the catalog correction to B, and leaves sentence/language guidance to A. No concurrent edits across these boundaries.

## Existing-data decision — resolved

The user explicitly authorized B to discard all SkellySpeak user data as needed during development: existing data does not need to be preserved. This supersedes the earlier pending upgrade decision and preservation proposal.

- Implement the current v13 schema directly. B may simplify or remove historical schema composition/upgrade machinery rather than maintain it for existing data.
- Erasing and recreating SkellySpeak development data is authorized without repeat confirmation. Coordinate workspace ownership and stop active owners before a reset; report what was actually reset in the hand-back.
- No migration, compatibility, backup or data conversion is required to preserve current conversations, progress or generation receipts. The generation-receipt feature itself still works for new data.
- Verify fresh creation, schema validation, restart persistence, revision constraints, publication invalidation and source deletion. Errors remain explicit; this development authorization is not an automatic production wipe-on-error policy.
- This authorization concerns application data. Git restrictions and source ownership remain unchanged.

No data was erased by this documentation update. The schema decision no longer blocks B or subsequent native QA.

## Handoff checkpoints

1. A guidance API and B generated action/snapshot contract reviewed from disk.
2. B persistence/lifecycle/credit cases complete; C connects and verifies real handlers.
3. Review completed diffs against coaching contracts and ui-guidelines. Resolve concrete defects with the owning domain through hand-backs.
4. Integration runs the combined work-plan gate and applicable README checks. Use `cargo ... --manifest-path src-tauri/Cargo.toml` from the repository root to avoid ambiguous working directories. Also run stylesheet validation for C and documentation checks for integration changes.
5. Native QA after the runnable artifact is ready; development data reset authorization is already recorded above. Declare model and a maximum total provider-request count covering every automatic reply/coaching/gloss/speech operation, not merely the number of Send clicks. Stop at that bound and report actual usage.
6. User checkpoints the reviewed wave with Git; no next-wave implementation until that checkpoint. Source completion, automated verification, linguistic review and native/device verification remain separate.

## Deferred details retained

Later waves still need XP deletion/exclusion wording, evidence-based partner milestone triggers, profile estimates and game-policy calibration. Those do not block wave-one language/focus/revision work. Full hint-first policy and retry-check operations arrive in wave two; richer support weights, profile estimates and reward tiers arrive in wave three.

## Earlier integration preparation verification

`git diff --check`, `npm run docs:test` (28 documentation tests and 7 parser-security tests) and `npm run build --prefix skellyspeak-docs` passed. The production build emitted an update-notifier permission notice after successful compilation; no system permissions were changed. These checks cover this documentation preparation only. No application source, generated IPC, database or provider behavior changed, and the application gate was not represented as rerun.


## Implemented and integrated

- A: explicit Arabic ALA-LC and Pinyin guidance, assessment quote preservation, Arabic question-mark segmentation, citation validation and a frozen Arabic guidance fixture. Primary-table review corrected initial hamzah, alif maqsurah, ta marbutah and article rules; expert linguistic review remains outstanding. See [A handback](coaching-w1-a-handback.md).
- B: transactional edit-and-regenerate with immutable earlier versions, later-suffix removal, stale-command rejection and revoked publication authority for late work. Fresh schema v13 refuses older schemas explicitly. Captured focus, five outcome values, catalog fingerprint and prompt provenance are connected. Revised demonstrated wording earns the current assisted 2 XP without direct mastery credit. See [B handback](coaching-w1-b-handback.md).
- C: real GuidedPage revision action, preserved drafts on failure, removal counts and confirmation, paginated earlier versions, conversation-switch guards and suppression of superseded speech/assistance. Reward presentation follows authoritative native credit. See [C handback](coaching-w1-c-handback.md).
- Integration resolved pagination across partial earlier-version pages, bounded suffix-count queries, late failure publication authority and revised-turn reward handling with the owning agents. Philosophical acceptance remains learner agency, inspectable evidence, room for self-repair and joy without coercive grading.

## Final verification — 2026-09-12 local time

- Frontend: `npm test` — **528 tests passed** in 84 files; `npm run build` and `npm run styles:check` passed. Vite retains its bundle-size advisory.
- Native: formatting check, strict Clippy for library/tests, generated-contract check and native binary build passed. The final `cargo test --manifest-path src-tauri/Cargo.toml --lib` run, including the added revised-wording credit regression, passed **269 tests**. The preceding combined gate passed 268 before that final test was added.
- Documentation: 28 documentation tests and 7 parser-security tests passed; documentation production build passed. The notifier permission notice occurs after successful compilation.
- Browser: inspected a test-only revision fixture at desktop and 360px width; no horizontal document overflow at either width. Earlier-version disclosure, concrete removal counts, Escape dismissal and focus restoration were inspected. This fixture does not establish complete GuidedPage or native interaction correctness.
- Native startup: `npm run macos:dev` built and verified the signed current-checkout bundle, started Vite and launched native PID 62313. All fresh run streams were inspected; startup diagnostics recorded application mount, registry load and 21 successful IPC calls with no recorded error/warning events. Run: `.local/logs/app-2026-09-13T00-25-50.293Z-ba8ab32e-c0f7-476d-a980-21e882cbfc20`.
- Interactive native QA was blocked by app discovery resolving the current bundle path to a stale identifier and finding multiple older bundles under its current identifier. No live provider requests were made, no user data was reset, and linguistic/model quality and device behavior are not claimed as verified.

## Ready for review and next checkpoint

Wave-one source and automated verification are ready for user review. The signed development application was launched for inspection. No commit, staging, push or other Git write was made during implementation. Concurrent iOS/release work in workflows, package scripts, README and iOS tooling was left untouched by coaching integration.

The user performs the Git checkpoint before wave two. Wave two adds hint-first coaching and retry/check policy; wave three adds richer learner estimates and reward policy. These remain planned work, not implemented features.
