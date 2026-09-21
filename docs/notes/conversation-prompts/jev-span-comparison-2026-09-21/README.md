# Jev quote-localization prompt/model comparison

## Authorized design

The user paused the proposed rollback and requested another attempt with alternate
second-stage prompts and Fast/Standard models, then requested more prompts while
the first batch was running. No Jev-disable edits were made before these runs.

Four prompts × two extractor models, reusing 60 frozen synthetic cases × two
saved Jev assessments. Each condition contains all 120 pipelines: 109 require an
extractor call, seven have no implicated skills, and four retain the original
Jev failures. **872 new extractor calls** across eight conditions. The original
Jev + Fast candidate and previous Chat assessment remain cached controls.

| Prompt | Manipulation |
|---|---|
| checklist | Explicit id coverage, substring verification, relationship spans |
| examples | Worked examples of temporal/reason spans and imperfect attempts |
| attempt_spans | Ground relevant components of partial attempts, not ideal mastery |
| source_first | Segment actual source clauses mentally, then map criteria |

Models: `google/gemini-2.5-flash-lite` (Fast) and `google/gemini-2.5-flash`
(Standard), the repository defaults. These are explicit experimental models, not
a read of the learner's mutable settings. Same provider pin (Google AI Studio),
temperature 0.7, reasoning disabled, 2048-token limit, schema and native validator
as the original two-stage candidate. Only model and system prompt change.

The schema requires nonempty quotes while the prompts permit an empty quote as
an explicit grounding failure. This is a known feature of the original candidate's
contract, retained for comparison; an empty answer is never scored as successful
publication. No prompt asks the model to fabricate support for Jev's selection.

Two frozen batches run one sequential worker each, rotating arm order per row.
Batch two was added after batch one started; their execution overlaps, so global
concurrency can reach two. Within-batch interleaving reduces time drift; between-
batch and historical-reference timing comparisons remain observational. No
retries or replacement responses. Conservative combined reservation: **$3.1271**;
actual spend must come from receipts. Credentials remain in `server/.env`.

## Evaluation and presentation

The dedicated dashboard reuses the established split-pane explorer, quote/receipt
inspection, SDT calculations, Plotly and seeded PCA/t-SNE/UMAP machinery. Each
candidate stays individually selectable; failed outputs remain inspectable.

Evaluate full pipeline completion, delivered focal hit/false-alarm rates, native
quote validity, and complete pipeline cost and latency. Compare with the previous
Chat system's **113/120 complete, 59/72 hits, 8/48 false alarms**. Do not select a
winner solely against absolute numerical targets or solely from surviving rows.
A candidate recovering delivery must also receive semantic quote review: copying
an existing substring is not proof it supports the skill. There is no composite
score that hides a speed/cost regression or a quality tradeoff.

Labels remain provisional and cover 12 focal skills, not all 45 available skills.
Repeated cases are not independent learners. These are exploratory reused cases,
not an untouched holdout. No statistical generalization or adoption claim follows
from a favorable number alone. A failure against the existing system is sufficient
to reject this candidate without claiming Jev is unsuitable for every possible design.

## Artifacts and reproduction

`plan.json` lists the exact per-condition directories. Each retains frozen requests,
raw structured responses, provider metadata/costs, and actual Rust validation output.
Run the existing `two-stage.ts replay CONDITION_DIRECTORY` for native replay.
Build with `two-stage-build.ts DIRECTORY --profiles-only`, then the existing
`explorer/project.py DIRECTORY --profiles`, then `two-stage-build.ts DIRECTORY`.
The two batches use `span-variants.ts`; the second plan uses the `additional` flag.

## Results

**No-Go for this two-stage implementation.** All 872 new calls completed; actual new extractor spend was **$0.219148**, with no missing billed costs. Every decodable completed response was replayed through the unchanged native validator; two first-batch Standard outputs failed the transport/output envelope and remain failures. No retries.

| Route | Complete / 120 | Hits / 72 | FA / 48 | Median ms | p95 ms | Total cost |
|---|---:|---:|---:|---:|---:|---:|
| Chat assessment (previous) | 113 | 59 | 8 | 808 | 1142 | $0.017960 |
| Jev + original Fast | 41 | 13 | 1 | 981 | 1530 | $0.065201 |
| Jev + checklist · Fast | 51 | 17 | 1 | 1006 | 1522 | $0.065931 |
| Jev + checklist · Standard | 68 | 30 | 1 | 1164 | 1925 | $0.105762 |
| Jev + examples · Fast | 48 | 17 | 1 | 971 | 1604 | $0.066150 |
| Jev + examples · Standard | 45 | 15 | 1 | 1205 | 1697 | $0.094170 |
| Jev + attempt_spans · Fast | 63 | 29 | 1 | 989 | 1577 | $0.066429 |
| Jev + attempt_spans · Standard | 78 | 35 | 1 | 1158 | 1792 | $0.096030 |
| Jev + source_first · Fast | 39 | 11 | 1 | 914 | 1400 | $0.065570 |
| Jev + source_first · Standard | 43 | 16 | 1 | 1148 | 1753 | $0.094367 |

The best candidate by completion and delivered hits is attempt_spans + Standard: 78/120 complete and 35/72 hits (48.6%), compared with Chat's 113/120 and 59/72 (81.9%). Its lower false-alarm count (1 versus 8) accompanies substantially more missed deliveries. Median composed latency is 1,158 versus 808 ms, and total cost is $0.096030 versus $0.017960 (5.35×). Historical timing caveats still apply.

The same Jev decisions can yield very different delivery depending on extraction prompt, but none of the eight candidates matches the existing application path. The all-or-nothing quote contract remains a major bottleneck. This rejects the tested application integration, not every possible Jev design. No semantic review score is claimed; zero adjudicated quote reviews. That limits positive quality claims but does not erase the measured delivery failures.

Per the user's conditional instruction, restore Chat assessment as the application default and disable Jev selection. Retain experiments and internal adapter code. Completed evidence and provider receipts are preserved. Application source verification is recorded separately below.

## Implementation and verification

Chat is the fresh-workspace default. Startup changes a saved Jev preference to
Chat, suspends unfinished unpublished Jev work, and leaves an explicit retry to
the existing current-settings retry mechanism. App settings show Jev as Disabled;
the native settings command rejects selecting it. Internal experimental adapters
and all historical receipts remain. Completed evidence is preserved.

- Full native suite: 503 passed, six intentional ignored experiments.
- Additional recovery test passed for a successful Jev decision followed by failed
  quotes: restart, retry Chat, publish the exact quote, retain both original receipts.
- Focused reward/message/settings UI: 64 passed.
- UI build and preview type check passed; existing bundle-size warning remains.
- Eight benchmark checks passed (five original harness checks, three expanded-study checks).
- Strict benchmark TypeScript check and Git whitespace check passed.
- Browser verified final 872/872 count, all ten paths, projections, and retained raw outputs.

No commit, deployment, app-data deletion, or live native-app restart was performed.
The restoration takes effect when the rebuilt native application starts.
