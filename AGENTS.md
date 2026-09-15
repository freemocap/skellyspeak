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

## Working notes

Put all new working notes, plans, investigations, verification reports, and
handoffs in `docs/notes/`, following [its README](docs/notes/README.md). Do not
scatter these files across the repository root, source folders, or documentation
website. Use descriptive names, group related topics when useful, and distinguish
proposals, agreed decisions, implemented behavior, and verification results.
Update existing notes for continuing work and mark superseded material clearly.
Maintained user/developer guides and module READMEs stay with their documentation
or code owners; promote settled information there when appropriate. Notes do not
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
