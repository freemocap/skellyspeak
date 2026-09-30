# Initial paid model comparison — 2026-09-30

Status: paid synthetic-only pilot executed; preliminary output review. No routing
change or deployment. Recorded conversation prompts were not sent.

Updated evaluation: [expanded analysis and next-run plan](model-comparison-expanded-plan.md)
adds exact frozen-schema validation, annotations for all 48 attempts, response
clouds, distributions and quality outcomes. Its findings supersede the limited
JSON-only screens below. The raw pilot measurements remain unchanged.

## Measured results

All 48 planned calls were attempted: 46 transport-complete responses and two HTTP
429 failures. Reported charges total **$0.02311524**. Costs for the two failures
are unavailable, so that amount is the known subtotal rather than a complete bill.

| Task | Completed pairs | Standard mean duration | Fast mean duration | Absolute saving | Reduction |
| --- | ---: | ---: | ---: | ---: | ---: |
| Partner reply | 5 | 592.6 ms | 389.6 ms | 203.0 ms | 34.3% |
| Partner word gloss | 5 | 1,594.4 ms | 1,572.2 ms | 22.2 ms | 1.4% |
| Coaching feedback | 6 | 1,446.3 ms | 1,303.0 ms | 143.3 ms | 9.9% |
| Reply assistance | 6 | 1,649.0 ms | 1,250.3 ms | 398.7 ms | 24.2% |

| Task | Standard mean USD/call | Fast mean USD/call | Absolute saving/call | Reduction |
| --- | ---: | ---: | ---: | ---: |
| Partner reply | $0.00034410 | $0.00010746 | $0.00023664 | 68.8% |
| Partner word gloss | $0.00103618 | $0.00033274 | $0.00070344 | 67.9% |
| Coaching feedback | $0.00078748 | $0.00021811 | $0.00056938 | 72.3% |
| Reply assistance | $0.00084023 | $0.00018460 | $0.00065563 | 78.0% |

These tables use arithmetic means over the same matched, transport-complete
pairs. Absolute savings subtract fast from standard; percentages divide those
savings by the standard mean. This replaces the earlier median-of-duration-ratios
presentation so the displayed percentages correspond directly to the displayed
absolute values. Values are rounded only for display. These include unusable
transport-complete outputs, so they do not measure cost per useful response.
Each task has only three underlying contexts.

## Design and provenance

Twelve frozen inputs: Spanish, Arabic and Mandarin, each with coaching on a
deliberate error, partner glosses for a tea question, a food-to-music topic switch,
and reply assistance for an ambiguous reference. Two model arms and two repetitions
give 48 planned calls. Within each pair, only the model changes. Frozen synthetic
cases retain their captured coaching focus. Canonical-encoding variants are excluded;
this run does not depend on the later controlled-fixture export.

The pilot is an initial screen, not the entire six-language corpus. In particular,
the gloss source is the fixed partner tea question, not the learner's preceding
negative statement. It does not measure preservation of negation in glosses.

Requests use the existing local experiment credential and the same pinned upstream
endpoint. Actual model identities, prompts, output schemas, response metadata and
reported costs are preserved in private local artifacts. The original conservative
reservation was $0.4577704. Actual charges are much lower and reported separately.

The first block stopped at an HTTP 429. A continuation submitted only unattempted
jobs, with five-second gaps, and stopped at a second 429. The final block uses
ten-second gaps for the remaining unattempted jobs. Neither failed job is retried.
Latency excludes those gaps and measures complete direct responses, not first-token
latency, application scheduling or a whole conversation turn.

## Observed quality differences

This is an unblinded review of actual outputs, not independent gold-label scoring.
Transport completion does not imply a valid or useful artifact.

- **Partner replies:** both arms' completed samples follow the requested topic
  change to music. Fast is a promising candidate for broader conversational tests;
  these short topic switches do not establish quality on long context or ambiguity.
- **Word glosses:** a fast Arabic output contains only literal spans and no word
  meanings. A fast Mandarin output overlaps spans and puts English words such as
  “drink” in target-word pronunciation fields. Standard avoids those particular
  failures in the paired outputs. This is evidence against a blanket gloss downgrade,
  even though standard's segmentation and context-specific meanings still need review.
- **Reply assistance:** fast repeatedly puts English translations or explanations
  into pronunciation fields. One Arabic output copies Arabic script into the Latin
  romanization field. Standard also sometimes uses translations or unchanged source
  text for pronunciation, and several suggestions repeat the clarification question
  rather than answering it. Both arms need work here; lower price is not equivalence.
- **Coaching:** both arms find the intended form errors, but also violate prompt
  constraints or provide questionable replacements. One standard Mandarin response
  is invalid JSON; another changes a count of apples into a weight of apples and
  explains it in the target language despite the English explanation setting.
  One fast Arabic response proposes replacing the word for
  “yesterday” with “I went.” Several outputs infer error causes or fill hint fields
  despite explicit instructions to leave them empty. Standard is not a gold answer.

The two 429 receipts belong to the fast arm. Their billing values are absent, not
zero. The retained receipts do not distinguish account contention from upstream
model limits; do not claim an inherent fast-model reliability difference from them.

## Artifacts and verification boundary

Private run directories:

- `.local/model-comparison-live-pilot-2026-09-30/`
- `.local/model-comparison-live-continuation-2026-09-30/`
- `.local/model-comparison-live-tail-2026-09-30/`

The combined `summary.json` and `report.html` are under
`.local/model-comparison-pilot-results-2026-09-30/`. The report retains every output,
exact inputs, raw timing/cost metadata, failed attempts and limited mechanical
screens. Ratios use only matched transport-complete pairs; failures remain visible
in the overall counts. Invalid-but-transport-complete outputs remain in timing/cost
comparisons, so savings are not quality-adjusted.

Native replay was attempted once and could not complete because another task's
in-progress practice schema requires an `idiomatic` field absent from language
configuration. This did not prevent paid inference or direct output review. No
other task's files were changed. JSON decoding, empty-gloss and overlapping-span
screens run independently, and are explicitly not substitutes for native acceptance.

The next useful experiment is broader partner-reply coverage with the same paired
method, plus targeted diagnosis of gloss and pronunciation failures before routing
changes. Production adoption is not justified by this small screen alone.
