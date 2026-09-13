# Coaching integration orientation

Baseline: `main` at `c740fe0` (v1.1.1). An explicitly requested fast-forward pull from origin/main reported already up to date. The checkout was clean before this documentation pass. No application implementation, database access, paid inference or native QA was performed.

## Reading map and intent

The active specification is `skellyspeak-docs/docs/coaching-plan.md`, with sequencing in `coaching-work-plan.md` and cross-domain contracts in `coaching-contracts.md`. All three wave-one agent briefs were read. Root DESIGN, DATA-MODEL, BUILD-PLAN, README and workflow guidance provide ownership and lifecycle context; the September 12 audit remediation explains changes after the original planning commit.

The design puts learner-chosen dialogue first. Freire, hooks and Illich supply the plan's stated rationale: learner-owned topics, graduated help, legitimate excitement, inspectable rules and freedom to stop. This pass reads that rationale; it does not independently validate the bibliography's research claims.

Language definitions resolve reusable script, orthography, romanization and trait knowledge by task scope. One construct registry supports six assessment lenses and multiple navigation views. Model observations are candidates; deterministic policy chooses feedback and credit. The learner profile exposes evidence, assistance, uncertainty, focus and due practice. XP represents evidence-caused effort separately from proficiency. Sound, animation and haptics are required reward behavior, with factual text and learner-controlled intensity. New-chat choices lower the first-move barrier without fabricating learner speech.

## Source checks

- `src-tauri/src/languages.rs:71` and `:82` still expose ALA-LC/PINYIN labels without the proposed guidance API. `linguistics/adapter.rs:320` still uses generic romanization instructions. `src/domain/language/sentences.ts:6` omits Arabic question punctuation.
- `src/features/guided/GuidedPage.tsx:278` rejects replacement sends; `:545` passes an undefined edit handler. `model.rs` has no ReviseTurn variant. Revision implementation is still future work.
- `src-tauri/src/progression.rs:34` still hardcodes replacement to null and catalog version to 4; `:107` projects focus. The checked persona/coach prompt files do not consume that active/recommended focus.
- The current projection already gives demonstrated assisted/revision evidence 2 XP versus 10 for unassisted evidence, with wording deduplication. `src/domain/skills/skill-rewards.ts:13` separately suppresses replacement rewards. Wave one must reconcile display with native credit; wave three introduces the richer support weights.
- `src-tauri/src/store.rs:29` is schema 12. Agent B's brief still requested schema 12 for revisions; this pass corrected it to the current contract's planned v13 and preserved the explicit upgrade-policy boundary.
- `src/domain/skills/message-evidence.ts` now checks catalog compatibility and throws for missing skills/quotes. The plan's description of a silent filter is stale after the audit.

## Integration work before implementation dispatch

Subsequent user decision: all SkellySpeak development data is disposable; resets are authorized without repeat confirmation. The earlier migration/preservation question below is resolved and superseded by `coaching-w1-integration.md`.

1. Settle v12 → v13 existing-data behavior. The approved receipt upgrade does not automatically authorize another migration or a reset. New schema tests can use disposable data; do not experiment on the user's workspace.
2. Specify durable turn identity versus presentation sequence. The native action takes a string turn ID, while current frontend editing/evidence uses numeric message sequences. B must expose a usable durable identity and C must send it; do not pass a sequence as a native ID.
3. Assign `src/domain/skills/**` explicitly. The briefs require generated Outcome consumption and reward/evidence changes there, but the ownership table does not allocate that directory. B's catalog exception also needs to be visible to C. Resolve these as integration assignments before concurrent edits.
4. Confirm wave-one reward behavior against the existing native credit projection, then explicitly authorize removal of the frontend replacement exclusion. Preserve deduplication and exclusions. Do not introduce wave-three weights early.
5. Specify revision-chain behavior: repeated revisions, earlier-turn suffix removal, retained earlier versions, prompt context filtering and invalidation of pending analysis. The broad contract exists; these are required implementation cases and acceptance checks.
6. Separate source checks from native QA. C's brief says no paid inference but also requires real revision/regeneration checks. A live test needs a declared bounded model/request budget under the work-plan rule; fixture tests alone must not be reported as a live check.

These are bounded integration details, not a request to reopen the product direction.

## Later-wave reconciliation

- The older `skill-progression-design.md`, docs architecture and ontology sections describe JSON ledgers and focus plumbing that are not the current rebuild. Use them for rationale only where compatible; reconcile their status before publishing new feature claims.
- DESIGN's older progress table maps participation to foliage, while the approved coaching plan assigns flower/star meters to evidence XP. The newer explicit decision governs coaching implementation; synchronize the older presentation descriptions.
- The coaching plan's UI table says the flower reads ConstructState, but §11.5 says XP drives it. Preserve separate XP and proficiency projections and correct that table before wave three.
- `game.yaml` forbids message-count rewards but its partner-milestone copy names conversation counts. Milestone triggering and copy must identify the eligible evidence cause.
- “XP never decreases” needs an explicit deletion/exclusion interpretation consistent with source-derived local reports. Nonpunitive time-away behavior is settled; retention and invalidation accounting must not be guessed.
- The wave-two observation sketch lists four outcomes while wave one exports five. Later-wave schema work must explicitly retain or retire not_observed with no-update semantics.
- LANGUAGE-CONFIG.md and SKILL-MAP.md are conceptual section labels, not present standalone specifications. The coaching plan says dedicated language-config and skill-map docs arrive with those areas.

## Execution order

Integration owns contracts, bounded assignments, review, combined verification and documentation. The documented cycle uses reports carried by the user; no domain agents were launched in this orientation pass.

Wave one: A provides language guidance and punctuation/citation checks; B supplies revision identity/action/snapshots, outcomes, catalog consistency and focus capture; C builds revision presentation and GuidedPage integration coverage, then connects B's real action. A's API and B's generated contracts are the dependencies, so those handoffs happen first.

Wave two: YAML configuration, observation/policy separation, hint-first coaching and genuine partner-first starts. Wave three: learner-state estimation/export, audio-derived fluency, profile/session surfaces and evidence-triggered rewards. Wave four: labelled, bounded evaluation.

## Verification boundary

This pass checked source and documentation and corrected a handoff brief. No application tests were rerun because no application code changed. The audit remediation report records 516 frontend and 257 native tests passing at its checkpoint; those are historical results, not fresh verification here. Every implementation wave still requires the work-plan gate, relevant README checks and separately identified device/provider evidence.
