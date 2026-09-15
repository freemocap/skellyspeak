# Native subfolders: whole-file moves only

Status: approved and implemented, 2026-09-15. Supersedes the implementation
scope of [the deeper decomposition proposal](deeper-organization-proposal.md),
which is retained as future work after the repository-wide folder pass.

The [completed move map](subfolder-moves.json) records the whole-file moves.
Verification results are recorded in [the checkpoint report](subfolder-organization.md).

Move existing files intact into the following responsibility groups. Names below
are existing filenames; add small Rust module indexes as needed. Update imports,
embedded-file paths, test filters and documentation references, preserving behavior.

| New subfolder under native/src | Existing files to group |
| --- | --- |
| learning/coaching/ | coaching.rs, coach_observation.rs, coach_policy.rs |
| learning/learner/ | learner_state.rs, progression.rs |
| learning/rewards/ | rewards.rs, reward_settings.rs |
| partners/persona/ | persona.rs, persona_prompt.rs |
| partners/generation/ | generation.rs, generation_receipts.rs |
| speech/recording/ | audio.rs, voice.rs, transcription.rs |
| speech/analysis/ | audio_inspection.rs, fluency.rs |
| ai/connections/ | access.rs, credentials.rs, model_routing.rs |
| ai/hosted/ | hosted.rs, hosted_mobile.rs |
| ai/transport/ | provider.rs, speech_provider.rs, grouped.rs |
| ai/policy/ | admission.rs, holds.rs, refusal.rs |
| storage/schemas/ | schema.sql, generation_schema.sql |

Where an existing file has the same name as its new folder, it becomes that
folder's `mod.rs` (for example, rewards/rewards.rs becomes rewards/mod.rs).
This is a whole-file move, not a split. Existing child-module declarations must
be updated without registering a child twice.

Leave conversations, application, configuration, language, statistics, diagnostics
and updates at their current depth for now. Also leave lessons.rs, mystery.rs,
partner_reaction.rs and speech/cache.rs as cohesive files at their existing level.
Do not create empty or single-file wrapper folders in anticipation of future code.

## Explicitly deferred

- Splitting execution.rs, store.rs, application/mod.rs, lessons.rs and providers.
- Distributing model.rs types to their domains.
- Extracting methods, transactions, prompts, tests or runtime orchestration.
- Implementing an automated file-size check. Design it for all authored source
  and test files, with explicit generated/vendor exclusions and a recorded baseline
  for existing violations. Prevent new violations and growth of oversized files
  without blocking unrelated work on the existing backlog.

The existing large-file inventory and decomposition ideas remain in the deferred
proposal. Expand that inventory across UI/native/server after the folder pass.

## Verification on implementation

Check the move inventory, Rust formatting and Clippy, native tests and binary
compilation, generated contracts, affected test filters and current documentation
links. Update AGENTS.md and native/README.md to the implemented folder map.
