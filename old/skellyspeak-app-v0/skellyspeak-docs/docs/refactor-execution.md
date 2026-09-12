---
title: Architecture refactor execution
sidebar_position: 7.2
---

# Architecture refactor execution

Active checklist, started September 9, 2026. The
[architecture plan](./architecture-redesign) defines the intended design. Current
behavior remains documented in [Architecture](./architecture) and
[Ontology](./ontology). Checked items below describe completed work, not approval
of an entire phase.

## Execution contract

The refactor uses a destructive, fresh-data cutover. No backups, imports,
compatibility adapters, dual schemas or data preservation work. The user handles
application data deletion. Git is read-only for agents.

Documentation and comments describe current contracts and explicitly planned
behavior. Do not include release comparisons, project-history narratives or
retrospectives. Delete unnecessary code and documents instead of archiving them.

## Working rules

One durable owner per concept, implemented in Rust. React renders shared snapshots
and owns transient interaction state. Initialize storage directly with the current
schema. Private coaching stays outside partner memory.

Each phase includes its replacement, all affected consumers, obsolete-path removal,
tests and current documentation. No temporary compatibility readers or adapters.
Do not mark a phase complete while cleanup or verification remains open.

## Ownership contracts

Define exact IPC, events, schemas and consumers for each boundary. Every concept
has one authoritative implementation.

| Boundary | Owner | Contract |
| --- | --- | --- |
| Difficulty and practice preferences | Rust conversation settings | Explicit persistent conversation choices; relationship defaults must be separately specified |
| Learner progress | Rust evidence service | Canonical learner/language ownership with source-attributed evidence |
| Frontend snapshots | Shared React store and IPC bridge | Scoped snapshots, revisions and selectors |
| Conversations and contacts | Rust contact and conversation services | Stable identities and explicit relationship ownership |
| Shared memory and private coaching | Rust memory and coach services | Separate learning evidence, relationship memory and private coach context |
| Language aids | Rust passage service | Shared validation, contextual caching and reusable annotations |
| Vibe and reactions | Rust analysis service | Separate authored Vibe, observations and reactions; enforced prose rules |

## 1. Learner and language ownership — next implementation boundary

Implemented slice: conversation difficulty is persisted by Rust and validated at
model entry points. Each conversation restores its selected setting on reopen.
Language profiles own focus, exclusions and progress. React scopes settings loads
and saves to the addressed conversation and waits for settings before greeting.

- [x] Implement independent, revision-checked conversation difficulty.
- [x] Connect conversation controls and prompt validation to that setting.
- [x] Test conversation isolation, stale saves, invalid storage and delayed responses.
- [ ] Verify two conversations in the same language retain distinct difficulty
  settings across switching and application restart through real Tauri IPC.

- [ ] Specify versioned entities, references and preference scopes before storage
  writes. Begin with one explicit local learner, separate from hosted login.
- [ ] Define canonical language IDs and explicit variety membership in the registry.
  Do not derive identity by blindly truncating language tags.
- [ ] Define conversation-scoped goals and assistance, plus explicit relationship defaults.
- [ ] Decide durable storage with a concrete schema and empty-storage initialization.
  SQLite is a candidate, not an installed or approved implementation. Keep durable
  domain records separate from disposable, bounded cache entries.
- [ ] Inventory settings by scope: device/account, learner, learner/language,
  relationship, conversation and transient UI. Keep credentials in their vault.
- [ ] Implement fresh initialization, schema validation and atomic writes. Test
  ownership, invalid states, interruption, restart and full reset with current-schema
  fixtures. Do not implement data conversion or compatibility behavior.
- [ ] Define one snapshot/event protocol: explicit scope and revision, listener
  registration before snapshot reconciliation, rejection of stale results and
  revision-checked mutations. Preserve explicit ownership during concurrent saves.
- [ ] Implement shared frontend state and connect every affected reader/writer.
  Zustand is the planned choice; no frontend persistence mirror of Rust records.
- [ ] Resolve effective difficulty and assistance from conversation settings in guided
  turns, coaching and suggestions. Keep proficiency estimates separate.
- [ ] Remove obsolete persistence keys, commands and invalidation paths; retain
  unrelated disclosure/draft behavior where it still belongs.
- [ ] Verify independent language preferences, explanation-language changes,
  dialect changes, restart, conflicting edits and switches during active requests.
- [ ] Update architecture, ontology, overview, README and roadmap for the behavior
  actually shipped; run relevant checks and real Tauri integration.

## 2. Contacts and relationships

- [ ] Implement durable contacts, multiple conversations, identity versions,
  latent background facts and inspectable/correctable shared memories.
- [ ] Implement static seeded SVG avatar recipes and manual configuration.
- [ ] Add editable persona Vibe groups, separate from observed conversation Vibe.
- [ ] Implement contact navigation and conversation selection; verify coach privacy,
  explicit ownership and restart continuity.

## 3. Shared language service

- [ ] Define passage/source-offset/provenance contracts and a shared validator.
- [ ] Implement bounded contextual caching, in-flight deduplication and version
  invalidation; reuse results across chat, coach, suggestions and word details.
- [ ] Consolidate all callers and remove redundant annotations/translations.
- [ ] Enforce emoji-free generated prose before display/persistence, including
  streaming boundaries; preserve user input and validate emoji metadata separately.
- [ ] Verify multilingual source integrity, context-sensitive meanings, cache
  invalidation, retry/error behavior and observable cost accounting.

## 4. Evidence, gardens and feedback

- [ ] Define source eligibility, assistance, repetition, edits and deletion rules
  before storing projections. Do not imply hidden lifetime retention.
- [ ] Implement language report cards and scoped proficiency history with evidence,
  uncertainty and no XP-to-CEFR conversion.
- [ ] Implement one garden per relationship and one flower per conversation:
  rounded seven-petal heads, deterministic recursive foliage, no automatic wilting.
- [ ] Implement sortable garden tiles, short chat titles, selected-flower focus,
  petal labels/details and advice/commentary panels with touch/keyboard access.
- [ ] Implement source-attributed Vibe observations, comprehension and emotional
  reactions, and descriptive statistics with explicit denominators and coverage.
- [ ] Reconcile all projections to eligible sources; verify stable growth,
  deletions, corrections and no extra model calls merely from opening statistics.

## 5. Measured optimization and expansion

- [ ] Create reviewed multilingual quality/cost/latency fixtures and benchmark
  independent annotation models against explicit acceptance gates.
- [ ] Evaluate exact licenses, coverage and packaging of reference resources.
- [ ] Integrate the first useful resource and batch unresolved contextual work.
- [ ] Extend language capabilities only with matching quality and platform checks.

## Completion gate for every implementation boundary

- [ ] One authoritative runtime path; all consumers connected.
- [ ] Remove unnecessary identifiers, code, tests, documents and historical narratives.
- [ ] Initialization, atomic-write, race and deletion scenarios pass relevant tests.
- [ ] Frontend tests/build, Rust lint/tests and documentation build pass; hosted
  checks run when their contracts change. Stop and resolve failures.
- [ ] Real Tauri and relevant device checks are recorded separately from unit tests.
- [ ] Current docs describe the implementation, and shipped items leave the roadmap.

Current implementation target: learner/language ownership and fresh storage.
