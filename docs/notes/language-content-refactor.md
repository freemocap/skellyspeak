# Language content and in-app browser

Status: implemented and automatically verified on 2026-09-16. Production UI
components visually reviewed; native application not launched. No deployment authorized.

## Decisions

- App-owned bundled teaching content; workspace-owned learner preferences/history.
- Readable language and variety identities, independent of standard tags, browser
  formatting support, UI translations and provider capabilities.
- One substantial authored document per language. Local orthography/romanization
  definitions use explicit local references; genuinely shared definitions have
  one owner and explicit shared references. No cross-language imports or merging.
- Rust authoring models generate JSON schemas. Parse, validate and resolve once;
  application and browser consume the same registry. Duplicate and missing
  definitions are errors. Preserve citations, instructional text and review status.
- Romanization supported choices and defaults are content. Learner scheme choice
  is deferred; current default selection continues to drive requests.
- Keep compact language selection; add a read-only in-app browser with variety
  selection, instructions/examples, learning material, source YAML, resolved
  context, reference provenance and bundled fingerprint.
- Development schema changes require explicit reset, never silent deletion.

## Verification strategy

Capture all current target/explanation variety contexts, starter selections and
partners before converting content. Compare after explicit identity normalization.
Exercise invalid documents, local/shared references, defaults, optional external
mappings, source provenance, hashes and schema drift. Run native/UI suites,
contracts, language/style checks and build; inspect UI separately.

## Implementation record

Initial working tree was clean. Before editing models, captured resolved contexts,
starter selections and partner definitions for every target/explanation variety
pair. The normalized baseline passes after conversion; instructional text and
selection behavior remain covered by that comparison.

Implemented 7 language documents and 5 explicitly owned shared documents,
replacing the previous 21 YAML files. Six generated schemas describe the authored
Rust models. Structural validation rejects unknown fields and malformed types;
semantic validation additionally checks references, bounds, defaults, citations
and policy relationships. See [the authoring guide](../../content/README.md).

Bundled content is the runtime authority. Repository tooling can load source
files directly, but workspaces no longer seed, load or export teaching config.
Typed content contributes to canonical registry and learning hashes. Source YAML,
schemas, bibliography and resolved provenance are available through a read-only
inspection command and `inspect-content` CLI.

Language and variety identifiers use readable names throughout application state,
fixtures and locale filenames. Optional standard tags/provider mappings remain
at integration boundaries. Learning languages do not require a translated UI or
browser integration mapping. Database version 18 rejects older workspaces with
an explicit reset requirement; no user data was erased or migrated in this pass.

The compact picker remains. Browse languages is accessible from it and More,
with search, varieties, readable settings, romanization examples, teaching
guidance, goals, starters and partner definitions in visible document sections.
Explanation context follows the app native-language setting automatically. A
single source/model/schema document viewer replaces nested disclosures. Browsing does not save preferences; the explicit
selection action saves a language and variety through the settings store.

## Verification results

- Full native library suite: 359 passed, 1 ignored. Local transport tests required
  loopback access; the authorized run passed.
- Full UI suite: 111 files, 697 tests passed after final changes.
- All 20 configuration tests passed, including baseline preservation, invalid
  documents/references, schema drift, hashes and optional integrations.
- Production UI build, strict Clippy, Rust bin check, formatting, generated
  contracts, language checks and all 49 stylesheet checks passed.
- Preview and end-to-end tooling typechecks, offline Android tooling tests,
  offline benchmark export/check and documentation link checks passed. No live
  device, external AI or deployment checks were run.
- Visually reviewed production browser detail components using real native
  inspection output at desktop and phone widths, including full source expansion.
  This was a component preview, not a running Tauri application. Temporary preview
  files and the development server were removed afterward.
- Production build retains the existing Vite large-chunk advisory.

## Deliberate limits and follow-ups

Learner-selected romanization is still deferred. The browser exposes supported
schemes and the configured default; it does not imply other schemes are active.
Existing multilingual lexical hints were preserved in each language's goal
material to avoid changing retrieval behavior; a linguistic content review can
narrow or revise them separately. Existing review statuses and citations remain.

Executable prompt assembly stays with native domain owners. This pass does not
make all AI behavior declarative or provide a live YAML editor. The existing
semantic validator remains a cohesive roughly 700-line owner: splitting its
policy checks merely to meet a size target was outside this pass. New authored
models, loading, linking, resolution and inspection have separate owners.

## Browser presentation revision

Removed the separate explanation-language and variety controls: those belong to
the existing native-language picker. Inspection subscribes to those settings.
All teaching sections and romanization instructions are visible without expanding
panels. Raw definitions use a document selector and a bounded source viewer.
The six browser tests pass, including native-context updates, visible guidance,
source selection, stale requests and explicit preference saves. This revision
was checked by tests and production build; the earlier visual review above
predates this presentation change.

## Language-specific browser content

Corrected the inspection projection: its readable guidance and goals now come
from the selected language and variety, including locally owned orthography
instructions. They no longer repeat universal assessment policy, generated
variety boilerplate, explanation-language instructions or the scheme instructions
already shown in Writing and reading. Empty guidance/goal sections are omitted.
Source paths and internal scope names no longer interrupt the main prose.

This changes inspection presentation only. Conversation resolution still composes
all applicable policy; its complete context and the shared source documents remain
available through Full definition. A native regression test checks Arabic's one
local assessment rule, iḍāfa goal, absence of repeated scheme instructions, and
continued availability of shared policy in the resolved model.
