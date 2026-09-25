# Content format, schema shape and prompt composition

Status: **format conversion implemented; composition design proposed**,
2026-09-24. The user authorized the Rust changes needed for YAML schema files.
This does not authorize a new runtime prompt composer or settle skill definitions.

## YAML on disk

All structured files remaining in `content/` now use YAML, including the nine
generated schemas. The README stays Markdown. The redaction-policy relocation
belongs to the other agent and has not been reversed or included in this change.

The schema vocabulary remains JSON Schema (types, properties, required, refs,
constraints); YAML is its file serialization. All nine parsed YAML documents were
compared with the previous parsed JSON and found equal. Export and drift tests
now write/read YAML, schema associations point to YAML, and native inspection
selects the renamed schema key. Runtime IPC/API JSON and generated catalogs
outside `content/` have not been changed.

The current [YAML language server documentation](https://github.com/redhat-developer/yaml-language-server)
explicitly supports schema definitions in JSON or YAML. Editor schema associations
retain their modeline convention and now point at `.yaml` files. The installed
VS Code extension version has not been independently verified.

## Schema shape preview

The workbench's **Schema shape** button shows an illustrative YAML instance plus
field paths, required/optional status and types. Local references are expanded;
arrays display one illustrative element, maps show a placeholder key, and enums
use one candidate. Alternatives and recursion are disclosed rather than silently
presented as fully composed content. Optional fields are included for exploration.
These specimens are not guaranteed-valid fixtures: placeholders deliberately
expose missing authored values and constraints remain in the source schema.

A schema describes allowed structure. It does not decide which sections become a
prompt, their order, the selected variety, or how context and user data are inserted.

## Actual composition today

Read-only inspection of `native/src/conversations/conversation_prompt.rs` found a
pure composer shared by native preview and execution. It chooses authored blocks,
adds resolved writing/pragmatics guidance, optional persona/topic/opening context,
time reference, turn phase and difficulty, and joins blocks with blank lines.
Persona background and topic can be serialized as JSON within that prose.
Difficulty has its own shared composition in `configuration/difficulty.rs`.
This is readable prose, but not a consistent Markdown document with explicit
section headings. No runtime formatting was changed during this pass.

## Proposed composition contract

1. **Identify inputs.** For each prompt, list required context and optional data,
   including target language, variety, explanation language where relevant,
   difficulty, turn phase and feature-specific fields. Missing required inputs
   produce an explicit error; no unresolved placeholders reach a model.
2. **Order sections deliberately.** Specify headings and block order rather than
   dumping every schema property. Distinguish instructions, examples and supplied
   data. Omit inapplicable optional sections instead of empty headings.
3. **Preserve authored prose and original examples.** YAML block strings hold
   readable Markdown. Do not normalize source examples or fold paragraphs into
   an opaque JSON string. Keep structured transport data separate where required.
4. **Compose language context correctly.** Once the guide design is agreed, use
   the shared core plus the selected variety's relevant material. Do not include
   every variant or substitute MSA for Levantine. That guide integration is deferred.
5. **Use one authoritative composer per prompt.** The developer preview must use
   that composer or a saved exact output, not a separately maintained approximation
   labeled as production. Show the exact outgoing text alongside its rendered view
   and disclose source files and chosen inputs.
6. **Verify with filled fixtures.** Check required/optional inputs, all difficulty
   levels, opening/response, selected varieties, multiline text, RTL/combining marks,
   literal braces/backticks and instruction-like user data. Check section ordering,
   blank lines, no empty headings, no unresolved substitutions and exact preservation
   of data. Review the rendered Markdown as well as the raw payload.

The [filled YAML specimen](prompt-composition-example.yaml) demonstrates proposed
headings around selected existing conversation blocks for Spanish/Mexico at
Beginner. It is explicitly an authoring example, not native output: it omits native
context resolution. It allows us to review formatting without pretending a new
runtime contract is agreed or implemented.

## Next checkpoints

- Review the [skill audit](skill-audit.md) before writing more language guides.
- Agree what the skill bands mean and clarify overlapping criteria.
- Review schema shapes as an explanation of current structures, not approval of
  premature guide schemas.
- Agree prompt section/input contracts using filled examples, then schedule the
  separate runtime-composer change and exact-preview integration.

## Verification

- Nine YAML schemas matched the prior JSON values exactly before removal of the
  superseded JSON files. All structured files in `content/` now end in `.yaml`.
- All 42 configuration tests passed; native content inspection accepted 20 languages.
- All eight workbench tests passed, including reference expansion, recursion and
  current-schema shape generation. Browser inspection confirmed the conversation
  schema displays YAML keys plus required/optional/type information.
- The [rendered formatting specimen](prompt-composition-example.md) is available
  alongside its YAML inputs for readable review. It remains a proposal.
- Broader `npm run contracts:check` reported a stale generated speech catalog.
  That output was not regenerated in this format-only change; parallel speech
  work remains separate. This is not a passing full-contract verification.
