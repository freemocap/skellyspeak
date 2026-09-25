# Analysis and coach intent checkpoint

Status: source implemented and automated verification complete, 2026-09-25.
Interactive verification of this polish in a matching desktop build remains open.

## Implemented

- Coach selection's information bubble previews the real native target for each
  mode, with its experience and retry-effort counts. It reads the same selector
  as turn admission and displays unavailable-selection errors. Previewing makes
  no inference request, changes no direction and awards no credit.
- Opening message Analysis requests grammar immediately when it has not been
  requested. Existing results and in-flight requests are reused. Failures require
  explicit retry. The redundant Explain grammar action is removed from this pane.
- Learner analysis shows saved positive skill evidence, supporting text, the
  skill criterion and access to the authored guide. Retained evidence can appear
  even when an unchanged retry earned no additional credit. Source and conversation
  identity must match; excluded observations are not shown.
- Partner grammar explanations receive compact skill names/overviews and any
  available learner evidence in separate fields. They may mention relevant skill
  names, grounded in their partner quote. These explanations do not assess the
  learner or award XP. No second classification request was introduced.

## Verification

- Full UI suite: 1,246 tests passed across 194 files.
- Native suite: 613 passed, three opt-in live tests skipped.
- TypeScript, generated contracts, shared styles and whitespace checks passed.
- Focused tests cover automatic grammar requests, strict-effect replay, saved
  results, explicit retry, deterministic preview/error presentation, source-bound
  skill display without new XP, and separate ownership of partner explanations
  versus learner evidence.
- Native binary and local development bundle rebuilt. A desktop inspection did
  not establish that the available window matched the new frontend assets; it
  does not count as completed visual verification. No deployment or commit.

## Proposed PR boundary and remaining gates

The proposed PR delivers the conversation → skill presence → source evidence →
experience/effort credit → profile → optional coach-directed conversation loop.

1. Verify the matching local app: hover/focus the coach info bubble; check counts
   and an unavailable effort mode; open Analysis once; inspect saved skill quotes
   and guides; reopen without another grammar call; verify visible retry behavior.
2. Review the shared checkout and choose the PR's exact changes. Concurrent work
   on presentation, content and other features must be identified, not swept into
   the PR by assumption. Check the final selected diff and update verification if
   review changes behavior.
3. User-authorized commit and PR preparation. Neither a commit nor deployment is
   authorized merely by this checkpoint.

Update: optional recommendation-driven drill generation is now implemented; see
[the drill checkpoint](drill-skill-generation-checkpoint.md).

Explicit follow-ups: broad guide authoring and variety coverage review, the future
reading surface and broader
attribution-quality/threshold evaluation. These are not implemented merely because
the conversation loop is ready for a scoped PR.
