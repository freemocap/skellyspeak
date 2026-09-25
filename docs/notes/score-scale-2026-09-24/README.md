# Grammar, conversational fit and partner understanding

Status: completed exploratory experiment; runtime scoring is unchanged.

## Design

36 authored cases cover twelve scenario clusters in Spanish (Mexico), Levantine Arabic and Mandarin Chinese (simplified writing). Each case receives two anchored rating treatments, 1–5 and 0–10, and a separate partner-understanding classification. Each request is repeated exactly twice: 216 requests total, no automatic retries. All completed with valid distributions. Actual cost: $0.008081472.

Grammar and conversational fit see only the preceding partner message and learner message. Understanding sees the actual subsequent partner reply. The latter measures evidence in that reply, not whether the partner ought to understand, how pleased they are, or whether they agree. A downstream emoji would be a presentation mapping, not an inference of emotion.

The two scale treatments use the same selected classifier. This is not a comparison with the application's generative feedback endpoint. Both offer insufficient evidence. The five-point anchors are selected from the eleven-point descriptions; this compares anchored scale packages, not isolated numeric formatting.

## Results and limits

Both scales achieved 94.4% agreement with provisional grammar and conversational-fit ranges; pointwise 95% cluster-bootstrap intervals were 86.1–100%. These are authored expectations, not independently reviewed gold labels. They should not be called measured accuracy. The different cases and target make these percentages incomparable with the earlier skills experiments.

The eleven-point grammar scale occupied only three numeric bins. Of 66 numeric grammar answers, 58 received the maximum in each arm. Wider labels did not establish useful additional discrimination. Do not interpret confidence distributions as calibrated probabilities of real learner proficiency.

Understanding matched all 36 authored cases in both repeats. A degenerate 100–100% bootstrap interval reflects zero observed errors, not certainty about performance on unseen conversation. The cases deliberately make the partner's evidence explicit; ambiguous natural replies remain a substantial gap.

One of 36 grammar pairs changed on the five-point scale; one conversational-fit pair changed on the eleven-point scale. No understanding labels changed. These repeats characterize consistency only. They are not independent language examples.

Intervals resample twelve semantic clusters, retaining translations and repeats together (5,000 seeded bootstrap draws). Language filters are exploratory. Numeric comparisons use (score−1)/4 and score/10 as descriptive normalizations of ordinal labels. Reference ranges and scale discretization can affect agreement; no superiority test or equivalence claim is made.

Median request times were 172, 172.5 and 171.5 ms for narrow, wide and understanding respectively. Rating requests contain two questions; understanding requests contain one. Costs are per request and are not directly per-question comparisons. These sequential calls do not test concurrent runtime performance.

## Recommendation

Retain 0–10 as the proposed score interface, without claiming greater measurement precision. Retain insufficient evidence rather than coercing it to zero. Review the disagreeing fixtures and add independently assessed, nuanced examples before replacing runtime feedback. Understanding is a promising separate categorical assessment. Its output should not block partner reply generation, and grammar assessment should not require that later reply.

These scores remain separate from experience and effort credit. The audit's remaining workflow and recommendation experiments have not run.

## Reuse and provenance

The frozen plan preserves every case, reference, request and repeat. Receipts preserve selected labels, distributions, timing, usage, cost and identity hashes. Actual model identity resolves from the existing selection record through the runner; aliases and hashes avoid duplicating that configuration. Do not edit frozen inputs to improve agreement after observing results.

To rebuild without new paid requests, run:

```sh
node tools/benchmarks/conversation-prompts/assessment/score-scale/build.ts docs/notes/score-scale-2026-09-24
node --test tools/benchmarks/conversation-prompts/assessment/score-scale/study.test.ts
```

To design another round, generate a plan into a new directory using `plan.ts`, review its fixtures and reservation, then explicitly run `run.ts` on that directory. The runner checks the frozen plan, selected identity and live price ceiling, refuses an existing run, retains failed receipts and performs no automatic retry.
