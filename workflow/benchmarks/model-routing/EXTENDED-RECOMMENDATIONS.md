# Task-specific model recommendations — repeated evaluation

Status: 384 paid synthetic requests completed on 2026-09-13. Production model
routing is unchanged. This expands the initial screen; it is not an app release
certification or an expert language assessment.

## Recommended next integration

| Task | Candidate | Decision |
| --- | --- | --- |
| Conversation partner | Groq GPT-OSS 120B | Preferred fast candidate; test with full production history and persona prompts before switching. |
| Short sentence translation | Gemini 2.5 Flash-Lite | Preferred economical candidate. All 15 translations preserved the tested negation and preference meanings. |
| Reaction label | Gemini 2.5 Flash-Lite | Preferred candidate: 9/9 expected labels, cheaper and faster than Flash. Only three distinct scenarios. |
| Word glosses | Groq GPT-OSS 120B | Preferred candidate with the provider grammar adapter and unchanged native validation. 12/12 complete nonempty results, but pronunciation quality still needs work. |
| Coaching | Retain Flash temporarily; fix prompts/contracts | No tested model is reliable enough to justify a blanket coaching upgrade. Recheck Flash and OSS 120B after fixing ambiguity, hint leakage and report-like wording. |
| Expensive coaching model | Do not enable Pro by default | Pro's higher cost did not resolve ambiguity or answer leakage. Evaluate only for a specifically demonstrated hard task. |
| GPT-OSS 20B | Optional latency-first translation candidate | Very fast simple replies and translations, but poor coaching, eight HTTP 400s on structured tasks, and gloss/pronunciation defects. Avoid as a universal fast model. |

DeepSeek and Qwen were not rerun here: the earlier screen found slower responses,
coaching defects or route-level rate refusals. This round concentrates repeated
trials on the affordable shortlist rather than claiming to rank all available models.

## Method and accounting

Thirty fixtures, three repetitions, four general candidates; Pro runs only the eight
coaching fixtures (24 calls). Six languages appear across the suite: Spanish, French,
English, Arabic, Mandarin and Japanese. Language coverage differs by task; coaching
covers four languages and native glossing three. Ten conversation fixtures, five
translation fixtures, three reactions, eight coaching fixtures, four native glosses.

Model order rotates by fixture and repetition. Four workers, no automatic retries,
90-second timeout per request, temperature 0.7. Flash and Lite use reasoning disabled;
OSS uses low reasoning. Pro uses low reasoning and a 4,096-token cap; others use
2,048. These are comparisons of usable configurations, not architecture-only tests.

Known usage cost: **$0.254210**. Eight HTTP 400 attempts supplied no usage, so their
cost is unknown. Conservative input/output reservations total **$3.304118**, below
the announced $5 ceiling. OpenRouter endpoint prices were checked before submission
and saved. Groq costs use returned token counts at the official price table reviewed
on the run date; they are estimates, not invoice reconciliation. Reported reasoning
tokens are included through completion-token usage, not treated as free.
[@groqModels20260913] [@openrouterGeminiLite20260913]

Raw requests use synthetic data only. No stored user conversations or recordings were
sent. Results, fixture hashes, run settings and catalog snapshots are saved alongside
this report. HTTP error bodies were not retained in this runner; the eight 400s must
not be attributed to a specific provider error subtype without a separate probe.

## How to read the results

Latency is full request-to-response wall time on this computer, not phone latency,
first token, queue time or Cloud Run end-to-end performance. Tables use medians of
mechanically accepted responses. The JSON summary also records empirical p90 values,
but 9–30 samples per task/model do not establish production tail latency.

Cost per 1,000 accepted outputs includes known charges for failed attempts in the
numerator. Unmetered failures make the OSS 20B structured-task figures lower bounds.
Coaching acceptance here is schema/source/selected-policy acceptance, NOT a claim that
the content is good advice. The frozen checker misses semantic answer leakage when a
full-sentence target contains a shorter leaked correction. Manual review found this.
No silently revised scoring is used to claim those outputs passed a stronger rubric.

All 120 conversation replies and 60 translations were read for intent and continuity;
coaching and gloss outputs were reviewed for concrete defects. Review was unblinded
by the implementing agent, not independent native-speaker review. Translation examples
are short and deliberately similar. No long-history, audio, suggestions, memory,
end-to-end app, adaptive-retry or high-concurrency certification is claimed.

## Quality findings that change the recommendations

- Flash repeatedly broke the conversation-partner role on Arabic fixtures: all six
  Arabic conversation outputs said it could not read/cook or was an AI. One abandoned
  the user's reading preference to offer recipes. That is poor product behavior despite
  mechanically valid text. Lite and both OSS candidates continued the tested topics.
  This synthetic prompt result is not proof of the cause of the app's earlier bug.
- All 60 short translations preserved the intended negation and reading preference.
  Lite is cheapest; OSS 20B is fastest. Paying for OSS 120B is unnecessary for this
  narrow translation workload unless a later context-heavy suite establishes a benefit.
- Lite's 11/12 native-accepted gloss count hides three outputs with **zero glosses**:
  all-literal spans still reconstruct the source but teach nothing. Only 8/12 outputs
  were both complete and nonempty. One other output overlapped source ranges.
- OSS 120B produced 12/12 complete nonempty gloss analyses. This is source integrity,
  not pronunciation certification: Arabic romanization and English pronunciation cues
  still vary and can be wrong. Keep the original script authoritative.
- OSS 20B produced only 7/12 complete nonempty native-accepted gloss results. It also
  gave English pronunciation cues for Spanish source words in one output. This is
  a functional defect, not just an unattractive explanation.
- Coaching ambiguity defeated every model. Flash changed the ambiguous French
  location to a cottage or online setting; Lite chose a restaurant or home; OSS
  asserted kitchen/online intentions; Pro alternated kitchen, omission, and cooking
  for the cat. A coach should ask what you mean, not decide for you.
- Multiple models invented error provenance such as transfer/developmental/slip
  from one sentence. Pro also revealed the correction inside an answer-free cue.
  OSS 20B misdescribed the French infinitive as a gerund or noun phrase. OSS 120B
  frequently retained criterion language; Lite and OSS 20B sometimes said “the learner.”
  Valid JSON alone would miss several of these regressions.

## Cost-aware rollout

Integrate routing for the narrow tasks first, preserving explicit failures and
per-task receipts. Start with Lite for translations/reactions and OSS 120B for the
partner and glosses. Retain Flash coaching temporarily while revising the contract to
allow unresolved intent without a forced correction; forbid unsupported error causes
and test explanation/hint semantics. Do not buy Pro calls merely because a task is
labelled hard. Escalation needs a demonstrated benefit and a recorded cost.

A failed-call-plus-retry costs both calls; the tables already charge known failures,
but no automatic retry policy was benchmarked. Do not extrapolate these tiny prompts
into a monthly bill without real token distributions: long conversation histories and
coaching candidate lists increase input cost. Parallel calls also repeat input, as the
separate split-call experiment demonstrates. Whole-task routing savings and chunking
latency gains must be budgeted together.

Next acceptance step is multi-turn app testing with actual production prompts,
edits, partial failures and per-turn total cost. These recommendations identify what
to integrate and test; they do not claim that production swapping has happened.

## Measured task table

Dollar figures below are known cost per 1,000 mechanically accepted outputs, not
per 1,000 tokens. Gloss rows additionally show complete, nonempty result counts.

| Model | Task | Accepted / attempts | Median ms | Known $ / 1,000 accepted | Complete nonempty glosses |
| --- | --- | --- | ---: | ---: | --- |
| openai/gpt-oss-20b | conversation | 30/30 | 130 | 0.0213 | — |
| openai/gpt-oss-20b | reaction | 5/9 | 269 | 0.0595 | — |
| openai/gpt-oss-20b | coach | 10/24 | 322 | 0.2930 | — |
| openai/gpt-oss-20b | native-gloss | 9/12 | 606 | 0.2862 | 7 |
| openai/gpt-oss-20b | translation | 15/15 | 135 | 0.0178 | — |
| openai/gpt-oss-120b | conversation | 30/30 | 183 | 0.0443 | — |
| openai/gpt-oss-120b | reaction | 7/9 | 446 | 0.1722 | — |
| openai/gpt-oss-120b | coach | 23/24 | 773 | 0.3644 | — |
| openai/gpt-oss-120b | native-gloss | 12/12 | 1168 | 0.5040 | 12 |
| openai/gpt-oss-120b | translation | 15/15 | 186 | 0.0428 | — |
| google/gemini-2.5-flash-lite | conversation | 30/30 | 327 | 0.0133 | — |
| google/gemini-2.5-flash-lite | reaction | 9/9 | 498 | 0.0394 | — |
| google/gemini-2.5-flash-lite | coach | 19/24 | 750 | 0.1899 | — |
| google/gemini-2.5-flash-lite | native-gloss | 11/12 | 887 | 0.2306 | 8 |
| google/gemini-2.5-flash-lite | translation | 15/15 | 314 | 0.0072 | — |
| google/gemini-2.5-flash | conversation | 30/30 | 510 | 0.0629 | — |
| google/gemini-2.5-flash | reaction | 9/9 | 802 | 0.1759 | — |
| google/gemini-2.5-flash | coach | 22/24 | 1029 | 0.5379 | — |
| google/gemini-2.5-flash | native-gloss | 11/12 | 1486 | 0.8902 | 11 |
| google/gemini-2.5-flash | translation | 15/15 | 494 | 0.0339 | — |
| google/gemini-3.1-pro-preview | coach | 23/24 | 5803 | 8.5777 | — |
