# A1 — Smallest reading-coverage plan

Proposal only, for Integration review before assigning implementation files. No active source edits, provider calls, benchmark or capability database. Language owns the current-five-language typed configuration contract; this report addresses shared gloss generation and meaningful coverage.

## Current evidence and scope

Read current linguistics/adapter.rs, adapter_tests.rs, native coverage methods, languages.rs, L1-gloss-diagnostics.md and L1-prompt-v3.md. These retained reports and fixtures establish the findings below; this is not a new review of live runtime streams or a retrospective diagnosis from raw user output.

The actual reported rejection was gloss_empty_or_reversed_span at supplied span index1. Prompt-v3 already addresses its mechanical generation burden with explicit {start,end,text} grapheme rows, first.start/last.end selection and no ID arithmetic. The decoder and output schema remain strict. One authorized synthetic sentence was accepted Complete with8 glosses and0 unresolved scalars; that is not a broad quality or semantic guarantee.

Integration additionally reports that the latest three saved turn results are structurally Complete, with one replacing an earlier accepted partial result after another request. That earlier result and the recent invalid supplied-span12 payload are not retained, so no exact replay or content diagnosis can be claimed for them. The constructed regressions below are deliberately synthetic and distinct from those live events.

The retained authentic Hola. response covers b0000..b0003 with gloss hello and b0004..b0005 as literal, leaving the final a unresolved. The native decoder correctly accepts this as Partial:1 gloss span,3 gloss-covered scalars,1 unresolved scalar. It must not be rewritten into a correct full-word response.

## Recommendation: keep v3, test coverage explicitly

Do not bundle another prompt revision with declarative language extraction. Keep the existing shared task template, output schema, exact passage and endpoint catalog. Typed configurations should initially preserve current IDs/defaults and registry projection, including current prompt bytes (gloss sends IDs; existing partner/coach templates use resolved names); configuration version is captured with request context, not used to reinterpret saved results.

No per-language prompt fork, deterministic whitespace word tokenizer or new endpoint representation is needed for this slice. Native grapheme boundaries remain universal safety coordinates; a grapheme is not a word. Language configuration can later provide a small reviewed grouping hint, but its extraction is maintainability work, not a claimed span-quality fix.

The smallest next work is deterministic regression coverage plus honest reporting of accepted help. If later evidence specifically demonstrates systematic omissions, consider one shared reminder to cover each linguistic word occurrence, including short/function words, while keeping uncertainty as omission. That would be a separately versioned prompt change. Do not ask the model to invent a word count, declare completion, or silently regenerate missing help.

## Keep three different questions separate

| Question | Current or proposed measure | Limit |
| --- | --- | --- |
| Is output structurally acceptable? | Existing strict decoder and source validator | Does not prove a gloss means the right thing |
| Is the source partition structurally covered? | Existing Complete/Partial and unresolved scalar count | Punctuation can make it Partial; literal-only output can be Complete |
| Do intended word occurrences have useful help? | For deterministic fixtures, reviewed full occurrence spans plus acceptable gloss alternatives | Cannot be inferred from character percentage or the model's own span count |

Examples make the distinction concrete:

- Hola. with only Hol glossed is valid Partial but misses the full intended Hola word. Its1 gloss span is not1 fully covered word occurrence. Do not call3/4 lexical scalars75% word coverage.
- sí! with sí glossed and ! omitted is structurally Partial but its only intended word may have useful help. This does not authorize inferring punctuation literal in the runtime validator.
- A literal span over all of sí! is structurally Complete with zero glosses and zero meaningful word help. Completeness must not be rewarded as useful coverage.
- Whitespace-only gaps are already handled deterministically as literal. Their size must not inflate a word-help denominator.
- Two occurrences of sí are separate contextual targets even if their written form and English gloss happen to match. A word-string cache or deduplicated set cannot measure their coverage.

A constructed semantic example such as A veces descanso. must retain separate word targets under the current word-only contract. A structurally complete set of literal dictionary meanings can miss the contextual meaning of an expression. Language can review context-sensitive word gloss wording within the existing fields; a future phrase explanation would be a separate layer and must not replace word anchors. Do not silently accept Unit::Phrase, add phrase fields or treat a multiword-expression quality concern as a source-validation defect.

At runtime retain existing coverage state and counts with their exact meanings; do not invent a universal word denominator. In fixture tests only, Language reviews expected source occurrences (or a small set of acceptable grouping alternatives). Compare exact occurrence spans; then check contextual gloss examples separately. Source reconstruction, lexical grouping and semantic usefulness are distinct assertions.

## Finite deterministic regression set

Use hand-authored synthetic completions and current builders/validators. No model calls are necessary. Extend existing tests only where coverage is missing; do not duplicate established grapheme corpus or decoder tests.

| Fixture | Expected evidence |
| --- | --- |
| Spanish Sí, sí. | Valid distinct occurrence spans; mutate supplied item1 to equal start/end and then reversed endpoints; both reject with gloss_empty_or_reversed_span,index1. Do not salvage item0. |
| Authentic Hola. response | Preserve exact captured response; assert Partial,1 gloss,3 covered scalars,1 unresolved scalar, and0 full matches for curated Hola target. |
| Spanish sí! | Contrast omitted punctuation, explicit literal punctuation, literal-only candidate and empty spans. Separate structural status from curated word-help result. |
| English No, no. | Two independently anchored occurrences; omission of one leaves partial word help. Use existing English config and a non-English explanation config to ensure roles are not conflated. |
| French café, café. plus decomposed e+accent variant | Exact source preservation, repeated occurrence mapping and full-grapheme endpoints; no Unicode normalization or accent stripping of source. |
| Arabic نعم، نعم. | Repeated RTL words and Arabic punctuation with source-order spans; display direction does not reverse offsets. Language reviews any marked/clitic extension separately. |
| Mandarin 我，我。 | Single-grapheme word endpoints must differ; repeated occurrences remain separate without whitespace tokenization. A second multi-grapheme case uses Language-reviewed grouping alternatives. |
| Spanish A veces descanso. | Construct structurally valid full word spans with context-insensitive versus Language-reviewed contextual wording; both may pass structural validation, so semantic assessment remains separate. No phrase substitution or new layer. |
| Mixed-script/emoji and CRLF extension of an existing fixture | Catalog reconstructs source exactly, no splitting a grapheme; nonlexical coverage status remains explicit. Reuse existing test if sufficient. |

For malformed cases, assert no accepted new result and exact fixed diagnostic/index; retain completion metering. For valid partial cases, assert the authentic gaps and useful full occurrences remain distinguishable. Existing scheduler tests own atomic publication, prior-result retention and retry budgets; request only a missing cross-domain assertion rather than duplicating the scheduler here.

For all five current configurations, validate one generic builder path and distinct target/explanation roles. Use native source mapping to construct known-safe fixture endpoints; malformed mutations are intentional. This checks data plumbing and source integrity, not model quality in five languages.

## Prompt size and acceptance boundaries

Named v3 rows are larger than the former start-only rows. Test the complete provider payload's existing admission boundary using one deterministic long-source fixture; adapter's256KiB prompt guard alone does not establish hosted admission. An oversized request must fail before dispatch without truncation, language-specific splitting or additional operations. Do not reintroduce large schema enums/complex bounded matchers that previously exceeded Gemini's grammar-state budget.

No validator relaxation, sorting/clamping spans, inferred literal punctuation, fuzzy source search, automatic repair, per-word inference or hidden retry. Invalid output remains failed; acceptable incomplete output remains partial. Source text and repeated occurrences remain immutable.

## Proposed ownership and finish line

Language proposes minimal typed configuration fields, resolver, version capture and any fixture grouping decisions. AI Operations proposes the shared prompt/coverage cases in this report only. Integration assigns concrete source files after reviewing both reports and owns cross-domain publication/admission checks. Interaction owns any label/display changes; this report does not assign UI work.

Finish line for the next implementation assignment: current-five registry behavior preserved, v3/schema acceptance unchanged, identified regression gaps covered with synthetic completions, precise distinction between structural coverage and meaningful full-word occurrence help, and relevant checks passing. This is sufficient for the bounded reading-assistance checkpoint; broader language expansion and model evaluations remain separate.
