# Standard versus fast model experiment

**Latest: the first paid synthetic-only pilot is complete.** See
[initial measured results](model-comparison-initial-results.md): 48 attempts,
46 transport-complete responses, two 429 failures, $0.02311524 in known charges.
The preparation status below is historical; no recorded prompts were sent.

Status on 2026-09-30: tooling implemented; recorded pilot expanded with authored
synthetic scenarios at the user's request. All preparation remains offline;
paid recorded-data execution awaits explicit private prompt-transfer approval.
No model-routing change, deployment, or commit was made.

## Purpose and precedent

Determine which current standard-role conversation tasks retain useful output
quality with the locally selected fast model. Previous conversation-prompt and
assessment studies used frozen plans, bounded reservations, receipt retention,
native validation, and inspectable paired outputs. This study follows that
workflow using recorded local requests rather than synthetic prompt variants.
The older top-level routing benchmark depends on retired inputs and was not reused.

## Implemented pilot

The original 19-case pilot below is retained as provenance. The current suite is
`.local/model-comparison-corpus-2026-09-30/`, with a review index at `index.html`.
Its recorded batch re-exports the same messages with the current native contract
builder, including the context-aware gloss schema. Use that batch instead of the
older pilot plan; the earlier artifacts were preserved and have never been run.

## Expanded synthetic suite

- 60 fictional semantic scenarios: ten families in each of six languages.
- Four additional canonically equivalent source variants: 64 exchanges total.
- Spanish, French, Arabic, Mandarin, Japanese and Hindi; absolute zero, beginner,
  intermediate and advanced settings. These are selected conditions, not a full
  factorial crossing of difficulty and scenario.
- Ten families: correct wording, deliberate form error, negation, clarification,
  topic change, ambiguous reference, goodbye, quoted directive, speech transcript,
  and longer conversation history with retained constraints and a revised choice.
- Seven task requests per exchange: partner reply, feedback, learner/partner
  glosses, reply brief, assistance, and explanations. Total: 448 synthetic requests.
- Together with the 19 recorded requests, two models and two repetitions produce
  1,868 planned calls. Recorded and synthetic provenance remains explicit.
- Saved-price reservation: approximately $16.52 across seven batches. Each batch
  is below the existing $5 bound; that is a per-batch bound, not a $5 suite limit.
  No paid calls have run, and every live batch must recheck prices.

Fixtures are authored directly in `tools/benchmarks/model-comparison/scenarios.ts`.
They import no recorded text. The generator uses only the selected model identities
from the recorded capture for synthetic construction. Production commands populate
disposable test workspaces; current prompt builders generate actual task requests.
The fixed partner texts provide controlled downstream context, not gold responses
or simulated paid outputs. Source Unicode is preserved verbatim through capture.
Synthetic transcript fixtures provide no audio and cannot test pronunciation.
Synthetic persona details and automatic topic selection are disabled using
existing application settings, so canonical source pairs share the same system
prompt and prior exchange without random persona fragments or coaching focus.
Recorded cases retain persona context. Preliminary expanded exports exposed this
persona-sampling confound and remain unused; the final suite replaces them.

Translations, canonical variants, seven task projections and repeated calls share
underlying scenarios; they are not independent samples. Proposed review criteria
need linguistic review and are never asserted to be certified gold labels. Task
history limits differ: do not penalize a task for information outside its input.
No new synthetic openings, private-coach messages or repair retries were added in
this pass; recorded cases retain that limited coverage.

Verification: strict tooling type checks and all six offline tests passed. Native
export passed for all 448 synthetic requests and 19 recorded requests. Checks
cover semantic-family coverage, canonical equivalence/source identity, dataset
partitioning, model/price binding, spending limits and paired-request identity.
These are setup checks, not model-quality findings.

## Original pilot provenance

- Private artifacts: `.local/model-comparison-2026-09-30/`.
- 19 recorded request cases; 76 calls planned, two repetitions per model/case.
- Spanish, French, and an Arabic opening are represented. Cases are selected by
  latest successful task/language, at most two languages per task; this is a
  convenience sample, not balanced multilingual coverage.
- Tasks: partner opening/reply, private coach reply, feedback and retry check,
  learner/partner glosses, reply brief, assistance, and explanations.
- Existing fast-role translations and skill extraction, classifier tasks, and
  speech remain outside the comparison.
- Live endpoint prices checked during planning. Conservative total reservation
  is $0.6641494, against a $5 hard pilot ceiling. This is not billed spend.
- No paid requests or measured quality/latency results yet.

Saved request messages are identical between arms. Current native builders export
source-dependent schemas; current task settings preserve temperature, output
limits and reasoning behavior. Alternate model order within cases. Native replay
validates outputs without granting credit or modifying the workspace. Raw outputs
and validated coaching observations are separate, since native acceptance can
drop unusable items.

The captured prompt and original saved context are private local artifacts.
The native schema is reconstructed with current source, not recovered from the
original request: historical schemas were not saved. The plan clearly labels this
limitation. Capture uses a read-only transaction and excludes connection targets.

## Review and decision rules

Inspect meaning, linguistic correctness, source coverage and task usefulness;
record concrete failures. Review output samples before revealing model arms where
possible. Standard-model output is a comparator rather than a gold label.
Schema-valid output alone cannot establish quality or justify routing changes.
Preserve unknown costs, failures, and partial runs in denominators and reports.

Measure completed-request duration, token usage, actual returned cost, native
acceptance and gloss coverage per task. With two repetitions, report median/range
and individual outcomes; do not claim stable tail latency or equivalence.

This is an independent-node screen. Fixed recorded upstream replies isolate model
differences but exclude their downstream effects. A subsequent integrated phase
should compare the current graph, each promising substitution, and the combined
candidate on the same conversational situations. Measure time to partner text,
time to assistance, time to audio, and completion of all branches separately.
Do not sum parallel request durations and call that user-visible turn latency.
That integrated phase and routing adoption are not implemented by this pilot.

## Verification and pending action

Native current-contract export passed on all 19 recorded cases. TypeScript strict
checking and offline tests passed for paired-payload identity, alternating order,
reservation accounting, and missing/failed-result accounting.

Automatic approval review rejected paid execution because private conversation
prompts would be sent to the external experiment endpoint and required explicit
destination/payload approval beyond the user's general spending authorization.
That specific approval was requested. Do not bypass the rejection or run the paid
command while the question remains unanswered. No paid calls were made.

See `tools/benchmarks/model-comparison/README.md` for commands and limitations.
