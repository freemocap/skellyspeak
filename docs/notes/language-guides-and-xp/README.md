# Language guides, writing-system guides and XP

Status: **integrated skills/XP flow; full supported-language authoring pass complete**, 2026-09-25.
The baseline assessment strategy, experience/effort rewards, coach selection,
Drill skill targeting and learner guides are implemented. The latest authored
coverage is 18 languages and 22 varieties; see
[the coverage checkpoint](all-language-content-coverage.md). Speaker review and
running-app review are separate from automated validation and remain explicit.

The current sequence is maintained in
[the evaluation and XP refactor plan](evaluation-xp-refactor-plan.md).
Earlier design and verification entries below are historical; statements that
bulk authoring or app integration are deferred are superseded by this checkpoint.

## Product direction under discussion

- Design a new catalog from the agreed
  [twelve-skill composition model](learner-facing-skill-plan.md). The old catalog
  imposes no compatibility, migration or coverage requirements; no crosswalk is
  needed. Replace obsolete behavior and reset affected development data when
  implementing the new system.
  Author language-specific guides explaining how
  each is expressed, with one structured source for readable cards and assessment
  guidance. Ordinary grammatical realizations belong in guides. Languages or varieties may
  define additional skills with distinct learning goals using the shared structure.
  Progression is separate from skill definitions and guides.
- Author material offline, by AI, people, or both. Origin and review status are
  separate. Clearly labeled unreviewed material may ship and inform assessment.
- Add shared writing-system teaching documents and language-owned reading
  guidance. A future **Read** peer to Chat and Drill is deferred; no new navigation
  surface, reading exercise engine or reading XP system is included now.
- Assess eligible learner attempts across the agreed catalog (currently 45
  implemented skills; the twelve-skill replacement is under design). Test whole-message and
  source-linked group inputs; do not assume segmentation improves accuracy.
- Compute XP deterministically from recorded experience and changed-retry effort.
  Success is outside the initial calculation. Defer novelty models, improvement
  bonuses and complex assistance weighting. Coach choices target breadth
  (Explore), depth (Continue practicing), or a mix (Coach’s choice).
- Explanations and optional highlights are requested on demand. Their availability
  does not gate awards and requesting them does not change the score.
- Expose effort, observed performance, estimated capability and evidence separately.
  XP is not proficiency; a model probability is not amount of practice.

## Correction: language core and connected varieties

Agreed correction, 2026-09-24: a language guide has one shared core and explicit
connected sections for its varieties. Modern Standard Arabic is one Arabic
variety, not the definition of the shared Arabic core. The discarded design that
filtered a whole grammar guide to MSA and left Levantine without it was wrong.

The core explains the skill, common structure and relationships among forms.
It can explain contrasts when there is no single shared grammatical realization;
it must not invent a universal form or require identical grammar across varieties.
Concrete examples that depend on a variety belong in that variety's section.
Each section contains its own explanatory text, examples, assessment guidance,
citations, authorship and review status. Explicitly shared examples may stay in
the core. Shared content is authored once, not copied into disconnected courses.

Selecting Levantine must show the Arabic core plus the Levantine section.
Selecting MSA shows the same core plus the MSA section. Other sections remain
connected for comparison. No silent substitution of MSA examples or standards for
Levantine. Later assessment uses core criteria plus the selected variety's
criteria; it must not mark a valid variety-specific realization wrong merely
because it differs from another variety. An unsupported realization within a
broad variety remains an explicit coverage/review question, not assumed error.

This policy applies to every language and its reading guides as well as its
skills. Shared script documents remain reusable across languages; language
reading documents add a core and connected variety sections. No new processing
branches by language name are needed.

The authoring validator requires a section for every configured variety of a
language guide, including meaningful examples and citations. A new variety
therefore exposes unfinished coverage instead of silently receiving another
variety's material. Draft sections may be `needs_review`; a schema pass is not a
linguistic review. These requirements apply only to guides being authored, not a
claim that all 45 skills or all languages already have guides.

Pilot scope remains Spanish, Arabic, Mandarin and Hindi using Devanagari.
The broader guide inventory can cover connected varieties. The completed evaluator
round used Spanish (Mexico), Levantine Arabic only, and Mandarin Chinese; future
MSA teaching coverage is not a prerequisite for Levantine.
The earlier Spanish prose specimens remain drafts requiring this composition
pass before promotion into application content.

## Ownership: the additional reading layer

| Owner | Teaching content | Must not own |
| --- | --- | --- |
| Shared script / writing-system guide | How symbols are organized; case, marks, joining, direction, units and reading conventions where genuinely shared | A universal pronunciation for letters used by different languages |
| Language reading guide | That language's alphabet or symbol repertoire, spelling-to-sound conventions, worked examples and links to shared guides | An alternate tokenizer, matching normalization or runtime language switch |
| Language-skill guide | How a shared capability is expressed in that language | New proficiency targets for every construction |
| Learner records | Actual attempts, assistance, judgments and rewards | Authored teaching definitions |

“Writing system” is the umbrella; an alphabet is one possible organization.
An ordered letter inventory is appropriate teaching data for an alphabet, but is
not a character allowlist or a substitute for Unicode properties in processing.
Examples may include multiple characters, combining signs or whole syllables.

Composition should use explicit references to shared material, not copies or deep
merge precedence. Language facts are content, not exceptions to shared processing.
Any new behavioral override still requires the evidence and shared-policy review
specified by AGENTS.md. Romanization, pronunciation and spelling remain distinct.

The existing `Script` field contains coarse entries such as `japanese` and
`simplified-chinese`; these are not all Unicode Script property identities.
Do not automatically equate the two or rename runtime IDs as incidental cleanup.
The initial guide design must support multiple writing components and must not
require one alphabet per language. The exact references are settled after review
of [the pilot documents](pilot-guides.md), before schema implementation.

## Step-by-step working plan

The [current refactor plan](evaluation-xp-refactor-plan.md) replaces the earlier
sequence. In particular, a small Jev experiment precedes bulk guide generation.

The detailed status and review artifacts live in that plan. The current sequence is:

1. Finish full-guide versus compact-baseline content composition.
2. Define saved attempts, revisions, assistance and skill observations (**next discussion**).
3. **XP weights agreed:** experience + effort, one point each per skill.
   Success is excluded; richer reward models are deferred.
4. Define a shared experience profile, optional gap-targeted recommendations for
   coach/chat/card/drill generation, and a saved language assessment with explicit
   and evidence-triggered refresh. Design this alongside steps 2–3.
5. Implement and verify the practice → assessment → XP/profile → recommended
   practice loop, including static guides and on-demand explanations.
6. Generate and review language-skill and writing/reading guides in batches.
7. Expand coverage and retire obsolete behavior without compatibility work.

**Completed:** twelve first-pass shared definitions, composition/progression
separation, YAML/Markdown specimens, workbench and the prompt-strategy experiments.
**Selected:** baseline B for Jev; richer explanations and examples remain in static
human-readable guides. Bulk authoring and app integration remain deferred. No new
prompt sweep or LLM comparison is queued.

The initial workbench supports existing-file edits with explicit Save, syntax
checking, original-text preservation and stale-file conflict detection. It has
file search, collection filters, outlines, references and incoming links. It does
not create/delete files, generate content, enforce the proposed guide schema,
resolve runtime inheritance, or make provider calls. Bibliography and generated
schemas are read-only. Identifier mentions are labeled separately from declared
references. More elaborate graph visualization, field forms and coverage reports
can be considered after this first version has been used.

Keep plans, content review, source implementation, automated verification and
running-app behavior distinct. No commit or deployment is implicit in this work.

## Current-code audit (2026-09-24)

- `content/shared/language-foundations.yaml` already has nine script entries,
  family/trait identities, shared orthographies and romanization definitions.
  The nine entries are Latin, Arabic, simplified Chinese, Devanagari, Malayalam,
  Hangul, Japanese, Cyrillic and Cherokee. They contain structural metadata, not
  learner-facing alphabet lessons. Languages choose local/shared orthographies.
- `native/src/configuration/documents.rs` defines script-linked orthographies,
  language definitions and `learning.goal_material`, currently lexical hints.
  Rich skill guides should not overload lexical matching hints.
- `configuration/loading.rs`, `linking.rs`, `resolution.rs`, `inspection.rs`
  and `schemas.rs` own load, links, effective context, browser projections and
  generated schemas. The loader rejects unknown files; merely dropping new YAML
  into content will not wire it in.
- `ui/src/features/languages/LanguageDetails.tsx` displays writing facts,
  romanization examples and source inspection. It is the initial reading-guide
  entry point. `features/skills/evidence/SkillDetailContent.tsx` composes skill
  overview, explanation and reviewed learner replies.
- `native/src/language/linguistics/` supplies source-preserving, grapheme-safe
  annotation machinery. Source coordinates and reading presentation are reusable;
  word annotations are not themselves skill assessments.
- `learning/coaching/assessment_adapter.rs` retains Jev's all-45 classifier.
  `conversations/execution/publication.rs` still retains Jev decisions separately
  and publishes through `skill_evidence`; this coupling must be changed before
  claiming score-first publication. Re-enabling a settings control is insufficient.
- `learning/rewards/` owns deterministic awards; existing turn/transaction,
  assistance and revision ownership must be reused. Reward animation remains
  presentation, independent of teaching documents and assessment evidence.
- Current uncommitted work includes speech routing in configuration and provider
  capabilities, recording preflight, native/server adapters, generated artifacts,
  localization and bibliography. Read current diff immediately before edits;
  no stale file replacement or migration framework is needed for this work.
- Drill has expanded substantially since the original plan. Preserve its current
  recording, matching and reading integration. This project does not revise Drill
  evidence or award policy by implication.

## Verification and reproducibility

Before this slice's documentation edits:

- `cargo test --manifest-path native/Cargo.toml --lib configuration:: -- --test-threads=1`:
  **39 passed**, zero failures.
- `node --test tools/benchmarks/conversation-prompts/assessment/jev-alone.test.ts tools/benchmarks/conversation-prompts/assessment/two-stage.test.ts tools/benchmarks/conversation-prompts/assessment/jev-decision.test.ts`:
  **6 passed, 6 failed**. Failures are missing saved `plan.json` dependencies in
  `jev-readiness-2026-09-21`, `jev-alone-2026-09-21` and
  `jev-two-stage-2026-09-21`. Saved Jev JSON plans/results were not found in the
  inspected experiment directories; Git lists reports and code, not these plans.

The historical reports are evidence of what was reported, not a successful replay
in this checkout. Recover exact artifacts if available; otherwise author and label
new fixtures/studies. Never fabricate historical receipts. Pure harness unit tests
should use self-contained synthetic fixtures; historical replay is a separate,
explicit check that fails clearly when required artifacts are absent.

After authoring this slice:

- `cargo run --manifest-path native/Cargo.toml --bin inspect-content -- --check`:
  **passed**, 20 languages; the actual loader accepted the updated bibliography.
- Pilot integrity check: **passed**, six distinct IDs from the current skill
  catalog, all nine cited bibliography keys present, local note links resolve.
- `git diff --check`: **passed**.
- Changes in this slice: these two notes and seven new bibliography entries.
  Existing speech-routing bibliography edits were preserved. No runtime source,
  application data, provider settings or deployment was changed; no commit was
  created. The pilot was queued to open in Codex for content review, not rendered
  in or verified against the running application.

Later validation must cover unknown/duplicate targets, broken citations, mixed
writing components, human edit preservation, unreviewed status, original Unicode
text, canonical equivalents and meaningful non-equivalents, requested explanation
language availability, and shared guide reuse across languages. Language names
belong in test fixtures, not processing branches. Use content/contract checks,
focused UI/native/server tests and applicable README checks at integration gates.

## Defaults and decisions still to make

- Pilot explanations are authored in English; original examples retain their
  language. Do not silently present English as another selected explanation language.
- Draft content is `needs_review`, AI-authored with references consulted. This is
  separate from a bibliography entry's source-reading status.
- Static guides must remain accessible without an inference call. Generated
  explanation is optional and source-bound; technical award breakdown is retained.
- The interactive XP equations and numbers remain hypotheses. Novelty detection,
  attempt eligibility, substantive retry semantics and proficiency estimation need
  the dedicated XP-policy review. No production curve change is authorized by a
  successful content-schema test.
- The first content checkpoint concerns structure, depth and ownership. We do not
  need a decision on a future Read curriculum or Read navigation to proceed.

This note replaces the conversation-only roadmap by adding the writing-system
track and current baseline. It proposes a new Jev integration direction; it does
not change the historical results or claim Jev has been re-enabled.

## Historical checkpoint: premature native implementation

- Implemented Rust guide types, bibliography/reference validation, generated
  authoring schema and language-inspection contract. Guide targets are language
  or script identities; a whole guide cannot be restricted to one variety.
- Inspection retains the same guide/core and all connected sections, with an
  explicit selected variety. Script guides have no language-variety sections.
- Synthetic tests exercise both Arabic selections, missing/foreign/duplicate
  sections, obsolete variety-filter rejection, Unicode preservation and credit
  hash isolation. These fixtures are not grammar content or linguistic evidence.
- Actual four-language authored configuration, learner-facing rendering and Jev
  integration are still pending. No live XP or prompt policy was changed.

Verification for this correction: **42 configuration tests passed**, including
three synthetic guide-contract tests; **13 language-browser tests passed**.
Generated schema and contract checks passed, as did UI TypeScript checking and
`git diff --check`. No running-app guide rendering or linguistic review was
performed; no commit was created.

## Authoring-workbench verification

Implemented separately from app/native code. TypeScript and three focused test
suites pass: reference navigation, source-preserving/conflict-safe saves, and
local HTTP access/save protection. Tests use temporary fixtures and leave authored
content unchanged. The local server was started and the reading UI inspected in
the browser. Manual checks covered full-text search, scoped-definition navigation,
readable example tables, and an explicit edit/save/restore round trip on the pilot
notes. The current collection has 43 files and no YAML/JSON parse errors. This
tooling does not approve or implement the language-guide model.

### Workbench layout follow-up

Implemented independently collapsible main panes, draggable/keyboard column
splitters, individually collapsible/resizable connection sections, browser-local
layout persistence and reset. Both YAML and JSON now have a connected tree view
with branch/global expansion and zoom. Read view uses distinct nested surfaces.
Five workbench tests pass, including layout/draft preservation and tree toggles;
browser checks covered the YAML tree, keyboard resizing and panel visibility.
No native or application integration changes were made in this follow-up.

The file sidebar now mirrors repository folder paths rather than grouping files
into a flat category list. Search retains and opens matching ancestor folders.
Six workbench tests pass; browser verification covered nested prompt navigation
and filtered folder paths.
