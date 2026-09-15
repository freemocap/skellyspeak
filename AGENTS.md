# Working agreement

## Current stage

The repository is organized into peer `ui/`, `native/`, `server/`, `docs/`,
and `tools/` folders, plus `content/` for editable behavior data and schemas.
The root README and layer READMEs describe this layout.
Internal module organization is a separate follow-up. Deployment requires explicit authorization.

Historical `DESIGN.md` and `BUILD-PLAN.md` files are archived under `old/notes/`;
they are not current specifications. Existing website documentation under
`docs/website/` is pending a content audit. Keep proposals, decisions, implemented
behavior, verification results and unresolved questions distinct.
Discuss ownership and user behavior before choosing storage,
frameworks, IPC or provider contracts. Do not present plans as working features.

## UI organization

Follow the folder map in [ui/README.md](ui/README.md). Keep application code under
`ui/src/` and respect these ownership boundaries:

- `app/`: startup, composition, shell, windows, navigation gestures and shortcuts.
- `features/`: product surfaces. `conversation/` owns session flow, messages,
  composer, reading assistance, coaching, partners, lessons, progress/rewards and
  speech interaction in named subfolders. `skills/` groups overview, evidence and
  learner views; `settings/` groups access, language and workspace controls.
  `activity/` and `startup/` remain small, cohesive features.
- `components/`: reusable controls, dialogs, feedback, reading, learning, media,
  localization, layout and persistence components. Feature-specific components
  stay with their feature; shared components must not import feature/app state.
- `state/`: shared navigation, session, settings and learning stores/hooks;
  initialization stays at its root. Feature-local state stays with the feature.
- `domain/`: React/Tauri-independent rules. Conversation state, reading logic,
  language identity and interface localization are distinct owners. `learning/`
  groups catalog, evidence, statistics and reward calculations. `rewards/` holds
  presentation geometry, separate from learning evidence and credit calculations.
- `platform/`: IPC adapters, audio/browser APIs, diagnostics, appearance access
  and updates. Native calls belong in `ipc/`; browser recording and playback
  lifecycle belong in `audio/`. Domain code must not import platform code.
- `styles/`: foundations, shell, components and feature styles. Keep `index.css`
  as the single ordered manifest; preserve cascade order when moving sheets.
  Style tools must scan nested folders and reject unlisted or missing sheets.
- `generated/`: Rust-generated outputs; update their source/exporter, not the
  generated files by hand.

Colocate implementation tests with their owner. Cross-cutting tests, shared setup
and mocks belong in `ui/tests/`; UI-only tooling belongs in `ui/tools/`. Keep
`public/` for directly served files and `assets/` for authored source artwork.
Do not recreate flat catch-all folders or bypass the dependency checks with
re-export aliases at old paths. Add subfolders for concrete responsibilities,
not arbitrary file-count targets. The mixed `src/types.ts` and large components
need separate, deliberate decomposition; folder moves do not authorize behavior
changes or deletion of unused code.

## Native organization

Follow [native/README.md](native/README.md). Native code stays under `native/src/`:

- `application/`: startup, shared runtime state, command registration and background
  scheduling. `lib.rs` declares modules and exposes `run`; `main.rs` is the executable
  entry point. `startup.rs` owns Tauri setup/menu construction and the ordered
  command registration list; `state.rs` owns Application, its store guard and
  credential synchronization; `scheduler.rs` owns the dispatch loop. Group native
  command handlers in `commands/{workspace,connections,hosted,partners}.rs`.
  State/credential and persona-generation tests live under application/tests/,
  registered by their owning modules. Preserve lock scope, sign-in cancellation
  and command names when changing these seams.
- `conversations/`: conversation turns, execution, prompts, opening choices,
  revisions, reading-result publication and conversation exports.
  `execution/` separates admission, holds, connections, turns, snapshots, dispatch,
  publication, reading retries, speech and recovery. Keep its stable public entry
  points in mod.rs and behavior suites in execution/tests/; do not recombine them
  into a single implementation or test file. Preserve transaction boundaries when
  extending these modules.
- `partners/`: persona definitions, generation, generation receipts, discovery and
  reactions. Group persona definitions/prompts in `persona/` and generation/receipts
  in `generation/`; discovery and reactions remain individual files.
- `learning/`: coaching, validated observations, learner state, progression, lessons,
  rewards and reward settings. Use `coaching/`, `learner/` and `rewards/` for those
  groups. `lessons/` separates types, repository access, lifecycle, quiz credit,
  prompt/context assembly and validated result publication. Lesson tests are grouped
  by generation, lifecycle, review, quiz and prompts. Keep durable turn ownership,
  one-time credit, evidence checks and serialized contracts intact across these seams.
  Keep evidence independent of presentation metaphors.
- `speech/`: capture, recording commands, transcription receipts, audio inspection,
  fluency timing and speech cache. Use `recording/` for capture/commands/transcription,
  `analysis/` for inspection/fluency, and `cache.rs` for playback cache.
  Network adapters belong in `ai/transport/`.
- `ai/`: shared access, credentials, hosted connections, routing, admission, holds,
  refusal handling and provider transports. Use `connections/`, `hosted/`,
  `transport/` and `policy/` for these groups. Conversation execution stays with conversations.
- `storage/`: workspace ownership, database initialization, schemas, reset and workspace
  copy export. Feature-specific persistence remains with its feature; SQL alone is
  not a reason to move code here. Schema SQL files live in `schemas/`.
  `store/` separates workspace locking, schema validation, startup, snapshots and
  record creation. Its `commands/` coordinator owns the single command transaction,
  replay checks and receipt commit; partner, learning, conversation and assistance
  handlers borrow that transaction and must not commit independently. Keep store
  tests grouped by workspace, schema, preferences, transactions and lifecycle.
- `language/`: language lookup, emoji/Unicode handling, linguistics and local fixtures.
- `configuration/`: loading and validating editable source defaults from root
  `content/`. Editable data stays in `content/`; executable prompt assembly stays
  with the responsible native domain.
- `statistics/`, `diagnostics/`, `updates/`: usage reports, diagnostic records and
  application update discovery respectively. `bin/` holds the existing CLI entry points.

Keep unit tests and fixtures with their owning module. Use explicit module paths;
allow cross-domain access only with the visibility required by current callers.
Do not restore the old flat root through compatibility re-exports. `run` is the
intentional library entry-point export. `model.rs` is a temporary mixed-type file;
its decomposition, large-file splitting and deeper subfolders require a separate
agreed pass. Preserve existing runtime ownership, synchronization, native command
names and serialized contracts during folder-only work. Update exporters and the
UI command-registration test when their source locations move.

## Server organization

Follow [server/README.md](server/README.md). `server/app/` owns the hosted FastAPI
runtime; `tests/` owns server tests and shared setup; `development/` owns the local
launcher, local logging and example configuration; `operations/` owns service
usage and reconciliation tools; `deployment/` owns Cloud Build configuration,
deployment verification, retention provisioning and upload checks. Keep package
metadata, Dockerfile and .dockerignore at the server root.

Within `app/`, group authentication under `identity/`, request/work limits under
`admission/`, AI contracts/routing/streaming/audio under `inference/`, budget/quota
under `accounting/`, and account/request diagnostics under `diagnostics/`.
Keep main.py, config.py and the shared transactions.py helper at the app root.
Tests follow those subject groups, with integration, development, deployment and
operations suites; shared conftest.py stays at the tests root. Existing cross-test
fixture imports remain until a separately agreed extraction. The development
entry point is `server.development.launcher`; its Python logging module is `logs.py`.
These are whole-file groups; quota.py and main.py retain mixed responsibilities
pending later decomposition, and logging consolidation is separate future work.

Use explicit `server.<area>.<module>` Python imports and module entry points.
Update Docker copies, upload allowlists, CI and root launchers when files move.
Package only runtime code into the image. Preserve private local.env and
.local-server locations when moving launcher source. Whole-file organization
does not authorize splitting main.py, changing runtime behavior or running live
administrative/deployment commands. Deeper server subfolders need a separate review.

## Source file size

Prefer cohesive source files below 500 lines; smaller files are fine. 500–999
lines is a danger zone for responsibility review, and 1,000+ is almost always a
strong signal to split. These are guidelines, not hard limits or CI failure
thresholds. A cohesive file may legitimately be larger: preserve correctness and
readability rather than adding artificial boundaries or substantial complexity
solely to meet a count. Record the reason when keeping a flagged file large.
Include colocated tests in the count;
do not evade the policy by compressing formatting or moving everything into one
large test/helper file.

The [repository size inventory](docs/notes/large-file-inventory.md) records the
current scan baseline and separates authored source from generated/data/docs files.

Large-file cleanup now proceeds one original file at a time, starting with the
largest flagged source. Complete and verify each split, then check in before the
next file. Preserve behavior and tests; automated size reporting is still a
separate follow-up. Generated files, lockfiles and vendored data
need separate treatment in that check rather than manual splitting.

## Working notes

Put all new working notes, plans, investigations, verification reports, and
handoffs in `docs/notes/`, following [its README](docs/notes/README.md). Do not
scatter these files across the repository root, source folders, or documentation
website. Use descriptive names, group related topics when useful, and distinguish
proposals, agreed decisions, implemented behavior, and verification results.
Update existing notes for continuing work and mark superseded material clearly.
Maintained user/developer guides and module READMEs stay with their documentation
or code owners; promote settled information there when appropriate. Keep fixture
provenance and third-party license notices beside their data. Design proposals,
research recommendations and historical contract snapshots belong in `docs/notes/`,
even when they describe a single source module. Notes do not
become authoritative merely by being recorded. Leave historical `old/notes/`
material in the archive unless individual content is reviewed and adopted.

## Reference boundary

Everything in `old/` is deprecated reference material. It is not the active
application, documentation or a specification. Read it for concrete design
questions and intentionally evaluate useful architectural ideas. Record reviewed,
adopted principles in active documentation under `docs/`; reference material does
not become authoritative by association. Do not copy code, configuration, tests or documentation wholesale.
Any implementation reuse requires explicit review against the approved design
after implementation is authorized. Do not run or maintain the reference
application as part of design work.

The rebuild starts from empty application data. No compatibility layers, imports,
backups or data-conversion work.

Development application data is disposable. The user explicitly authorizes agents
to erase and recreate SkellySpeak user data as needed during development, without
repeat confirmation. Existing conversations, progress and generation receipts need
not survive schema changes. Prefer a clean current schema over preservation or
migration work. This is development authorization, not permission for silent
production data loss; retain explicit errors and correct workspace ownership.
This does not authorize deleting source code, Git history or unrelated app data.

## Collaboration

Keep communication concrete and concise. Product UI uses plain functional labels:
no marketing copy, slogans, saccharine encouragement or filler. This rule governs
text. Reward presentation (tiered sound, animation and haptics defined in the
coaching plan's game layer) is required product behaviour, not decoration to strip. Settings must be
compact, with related inputs grouped and secondary details collapsed. Continue authorized design work and flag
meaningful decisions. Ask for user checks only when there is a specific artifact
to review. Distinguish design review, source implementation, automated verification
and a running application. Explain exactly what is ready to inspect.

Keep product design finite and specific to SkellySpeak. Do not reopen settled
platform, AI access or on-device/no-sync decisions through generic questionnaires.
Defer nonblocking details to focused design passes. Learning feedback and rich local
statistics deserve focused review before technical contracts; avoid repeated approval
questions for routine details.

Statistics are dense, mechanical scientific reports: numeric tables, distributions
and time series, organized by global usage, selected language and conversation
partner. No conversational or motivational statistical summaries. Performance-based
guidance belongs only in the language assessment area or separate coaching.

Keep domain records and metrics independent of visualization metaphors. Gardens,
flowers and alternative views render the same underlying data; renderer geometry,
styling and random seeds belong to presentation configuration. Evaluate geometric
Vibe matching through reusable embeddings and emoji references without presuming
a generative LLM call per observation.

## Coaching plan and research

Coaching, learner-model, new-chat and game-layer work follows
`docs/website/docs/coaching-plan.md`, executed per
`docs/website/docs/coaching-work-plan.md`, with the seams between work areas in
`docs/website/docs/coaching-contracts.md`. Cite research through
`references.bib` keys at the repo root (`sources: [key]` in YAML, `// [@key]` in
code, `[@key]` in docs). When research informs a change, add its entry with `url`,
`review` and `claim` in the same change.

## Git

Agents may stage changes, create commits, create and switch branches, merge,
push commits to the configured remote, bump versions and create and push release
tags as part of authorized work, without repeat confirmation. Keep version
metadata and lockfiles consistent, run relevant checks before committing, and
summarize commits, version changes and pushes performed.

Inspect the working tree first and preserve unrelated user changes. Do not
include unrelated changes in commits. Destructive operations (including force
pushes, discarding changes, deleting branches or tags, and rewriting published
history) require explicit user authorization. Do not change Git configuration
without explicit authorization. Publishing packages and deploying applications
require explicit authorization; permission to push commits or tags alone does
not authorize triggering a known publishing or deployment workflow.

## Quality

Fail on errors; do not substitute warnings or silent fallbacks. Keep documentation
about the active design and actionable questions. For UI work, review applicable
current guidance; the archived
`old/notes/ui-guidelines.md` is historical reference, not an active specification. Use TypeScript for frontend tooling. Run the relevant checks in README.md;
do not run archived application workflows.
