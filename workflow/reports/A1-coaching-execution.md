# Dependency-driven private coaching: execution proposal

Updated September 11, 2026. Source audit: rebuild `b68c64a`. The latest user decision prioritizes responsiveness over saving a request and supersedes both explicit-review-first and the single automatic call after contact text. No production edits, paid calls, benchmarks, Git writes, deployment or process restarts.

## Settled graph: dispatch when actual inputs exist

| Operation | Inputs and eligibility | Result |
| --- | --- | --- |
| Contact reply | Saved learner message and captured prior contact context | Contact text through existing foreground machinery |
| Automatic learner feedback | Same saved learner text plus already-available prior context; eligible immediately after persistence | Correctness and contextual understandability model estimates, source-linked SIX-category skill evidence, compact explanation/corrections |
| Automatic response help | Accepted contact TEXT plus focal learner message and captured context; eligible immediately on text publication | Suggested next responses and response-dependent help |
| Explicit deeper analysis | User's question, selected immutable source and relevant saved artifacts if available | Separate private detailed result |

Contact reply and learner feedback are siblings. Response help depends on contact text, NOT on learner feedback. Neither analysis stage waits for speech, gloss, translation or audio playback. Results hydrate independently: feedback can appear before the contact reply; suggestions can appear while feedback is still running or has failed. There is no shared completion barrier or automatic stage1→stage2 handoff.

Each stage has a separate logical operation, attempts, usage, cancellation/retry and validated saved artifact. All difficulties use exactly this machinery; Absolute zero adds no special requests or language-help mechanism. Opening saved details costs zero calls. Deeper analysis is explicit and never automatically runs to repair or complete another stage.

Language owns exact stage schemas, SIX skill-category definitions, score scale/anchors/unscorable semantics, source mapping, bounded corrections/suggestions and aggregate output budgets. These remain under reconciliation. Scores are model estimates, not established accurate measurements, calibrated proficiency or automatic XP. Existing seven-domain design text and legacy numerical UI types are not authority for the new six-category contract. Gamification remains separate review.

## Existing behavior and concrete implementation gaps

Current `COACH_PLAN` creates local `coach_context` then one Standard freeform `coach_reply`. It captures up to 40 private coach messages and newest 20 contact messages as embedded role/text, validates stop/prose and inserts a private assistant chat message. It does not implement the two automatic stages. Existing composing-help/proactivity settings in prompt JSON do not constitute scheduling behavior; `conversationTurns` supplies empty scaffolds rather than completed analysis.

Source anchors: `src-tauri/src/execution.rs` accept_turn/dispatch/finish/refresh_turn/control_turn; `turn_plan.rs`; `access.rs::resolve`; `admission.rs`; `lib.rs::scheduler`; `provider.rs::payload_with_output`; `grouped.rs`; `store.rs` command receipts; `src/lib/conversation-view.ts`. This is source inspection, not live-log diagnosis.

Minimum operation placement: source-owned automatic children associated with the original exchange turn, not new `AskCoach`/`COACH_PLAN` turns or synthetic coach user messages. Learner feedback must become eligible after learner persistence even while its original turn is pending for contact reply. Response help is released by accepted contact-text publication. The current hardcoded release list must be extended deliberately; simply adding two declarations is insufficient.

Both need dedicated validation/private-result projection BEFORE generic `finish` inserts an assistant message. Keep contact reply state and independent analysis states distinct: analysis failure must not convert a successful reply into a failed reply, and generic `refresh_turn` currently aggregates child failure. Automatic operations must not occupy a new conversation-wide pending gate; no UI conversationBusy from coaching. More specifically, `refresh_turn` currently keeps a turn pending whenever any child is ready/running and no assistant message exists. If the contact reply fails while early feedback runs, that would still block Send. Derive primary-reply pending from primary operations, not analysis siblings; permit dedicated feedback publication under valid source/attempt authority even when the primary reply is failed. Parent aggregate success must not be its publication gate. Historical deeper work must not reopen the original turn as a pending conversation reply.

## Capture, privacy and independent relevance

Learner feedback captures immutable learner message ID/text/version and deterministically selected prior contact-channel context, including the preceding question when available. It cannot use the future reply as evidence. Response help captures the actual contact reply ID/text/version plus its learner source and relevant preceding context. Each captures language/variety, explanation language, difficulty/settings revision, known composing-assistance provenance, prompt/schema/selection policy and route/model/endpoint/profile/credential reference. No key secret in context.

Proposed initial context policy: focal source plus up to two preceding contact-channel messages, ordered by durable sequence. Response help adds the accepted contact reply. Exact selection and size limits require Language/Integration agreement. Capture every required source's identity and exact text, not only the main message. Retry uses the same captured request; it does not re-read later conversation/settings.

Any required source edit, deletion, ownership loss or access revocation invalidates publication for that job. No fuzzy matching, silent replacement, source normalization or rewritten quotations. New conversation turns alone do not invalidate historical feedback: a late result persists on its own source. Late suggestions remain inspectable there but cannot replace the latest reply's suggestion tray or overwrite any draft. Draft insertion is explicit and never sends automatically.

Private feedback/evidence/suggestions and coach chat never enter contact prompts. Newly generated explanation/examples use shared language-config writing guidance; verbatim excerpts stay exact. Assessment-only exclusion is distinct from source-access revocation: it may suppress evidence aggregation while retaining private explanation/help. Language/Integration must agree that distinction before implementation.

## Capacity and priority: same limits, two helper stages

The user accepted the helper-ceiling direction; concrete implementation remains unassigned. Keep one shared four-slot inference pool and at most three active helpers globally across turns. Learner feedback counts as a helper even though its parent contact turn is pending. Response help also counts as a helper, alongside speech, gloss, translation and explicit deeper analysis. No separate model pool and no silent global-capacity increase.

Foreground transcription/contact replies receive priority. Ready helpers dispatch as soon as normal eligibility and capacity allow; do not wait for a future stage, fill a batch deliberately or serialize all helpers. With one contact reply plus learner feedback active, other permitted helpers can overlap. When contact text arrives, response help and speech/gloss/translation become independently eligible; at most three total helpers run, reserving headroom for the next voice/reply request.

Recommend speech priority within helper work, then explicit deeper requests over automatic backlog, with deterministic fair ordering among ready learner-feedback, response-help and reading helpers. Reliability must finalize tie-breaking/aging so neither stage starves; prioritize current interactive help without silently dropping required older feedback. “Immediately eligible” does not mean unlimited simultaneous requests or a guaranteed completion order.

Priority is not preemption: already-running requests occupy slots until completion/cancellation. Do not admit a fourth helper merely because foreground is momentarily idle. Enforce helper classification together with the actual shared semaphore and existing audio waiting rules. A slot reserved from helpers may still be occupied by another foreground request; finite capacity can produce waiting.

Do not let an automatic backlog make global outstanding-work admission reject the next contact send. Persist source-owned work intent and admit bounded work batches separately from foreground acceptance. The three-helper ceiling bounds active requests, not durable backlog/storage or starvation. Finite deferred-work retention, fairness, visibility, hard-budget behavior and recovery remain implementation gates. Preserve bounded resources; do not silently bypass the current 64 outstanding-work or 16-attempt turn limits.

## Lifecycle, cancellation, retries and metering

Create one logical feedback job per learner-source/version/task identity and one response-help job per accepted reply-source/version/task identity, transactionally or through uniquely constrained recoverable intents. Repeated events/renders do not create duplicates. Local command receipts deduplicate explicit deeper-analysis requests. Grouped attempt/digest deduplication does not guarantee exactly-once upstream execution; direct-provider deduplication must not be assumed.

Cancel/retry stages independently. Failed feedback does not block response help, and failed contact generation does not invalidate already-valid learner feedback. Without a contact reply, response help makes no request and is marked not available because its dependency did not complete, not failed coaching. While the reply is still pending it is waiting for contact text; after reply failure/cancellation it is dependency-unavailable. A later explicit contact retry can release one response-help job when valid text is eventually published. Cancel semantics for an entire exchange versus a single child must be explicit; completed feedback may remain unless source authority is revoked.

Explicit retry creates a fresh attempt for the same captured source-owned operation, never regenerates a contact reply/speech and never reruns the other stage. Do not reuse generic late-turn retry insertion rules for historical artifacts. Source validation and authority checks occur before dispatch and atomically before publication. Cancellation is local; upstream work/billing can continue. Group transport may continue for active siblings, whose outcomes and permits remain independent.

Restart leaves running attempts unknown and pauses work under existing recovery rules; no automatic replay or JSON-repair loop. Retain reported usage even for rejected output. Unknown usage is not zero. Apply the existing attempt protection consistently as described below; deeper requests are explicit new logical work. Parent terminal-state changes remain an explicit implementation seam.

## Standard/Fast and the three explicit routes

Use Standard for both stages initially: contextual learner judgments and response suggestions need language understanding and the current structured transport supports the approved Standard path. This is a requirements-based starting point, not measured accuracy. Fast eligibility is per stage AND exact route/model/endpoint, after schema support, source fidelity, multilingual/no-evidence behavior and task quality checks. Response-help could be a future Fast candidate, but naming it fast or changing operation role does not implement routing. No classifier or fallback call is needed.

`Capability::Chat` currently resolves Standard for Hosted, OpenRouter and Custom. Hosted prose and non-OpenRouter structured requests restrict the model to `google/gemini-2.5-flash`; OpenRouter disables fallback and requires structured-parameter support. Custom uses the grouped endpoint protocol, so generic OpenAI-compatible support alone is insufficient. Preserve all three explicit routes and captured credentials/authority. Report unsupported configuration instead of switching route/model. Any Fast expansion needs separately assigned resolver/transport/server work and evaluation.

## Request-count and token consequences

Automatic coaching now adds **two** model inferences per successful completed contact exchange: one learner-feedback request and one response-help request. A current all-features voice exchange has transcription + contact reply + gloss + translation + speech = five inferences; with both coaching stages it has seven. A saved learner message whose contact reply fails still permits one learner-feedback inference; no response-help call occurs without its required text.

Opening either saved artifact costs zero. Each explicit deeper request adds one, and each explicit retry may add one even after an unknown prior outcome. Grouping can reduce desktop HTTP calls, not model inference charges. Two stages repeat some context/schema overhead, accepted by the user in exchange for earlier feedback. Keep each stage's input narrowly selected; no automatic evidence/correction/scoring subcalls.

Current text payloads request max 2,048 output tokens, temperature 0.7, reasoning disabled. Language must bound each stage envelope with margin; a truncated result fails rather than becoming partial scores. Preflight serialized input/schema limits, not a guessed chars-to-tokens ratio. Cost is the sum across attempts of `(input_tokens × input_rate + output_tokens × output_rate) / 1,000,000`, using actual route rates and reported usage; no live prices/token benchmarks collected. Do not assume cache savings.

## Minimal admission and accounting recommendation

Separate concurrency, outstanding work, retries and intentional new requests:

- **Concurrency:** retain shared capacity 4 and the user-accepted helper ceiling 3. Both automatic stages count as helpers, as do speech/gloss/translation and explicit deeper work. This is concurrent capacity, not a lifetime call allowance.
- **Outstanding work:** retain the existing 64-work admission bound. Count ready, waiting_dependencies, running and paused admitted network work consistently across all kinds; local context work is not inference. Automatic intents remain deferred until eligible for actual dispatch, rather than pre-filling a second ready queue or reserving foreground-send budget. Reuse bounded eligible selection. Reliability must verify that automatic intent creation cannot make foreground acceptance fail solely because of deferred coaching backlog.
- **Retries:** retain the existing 16-attempt protection for the original exchange's operations, now including both automatic stages. Count every recorded attempt consistently, including cancelled, failed and unknown attempts; new automatic IDs/configuration versions/recreated events must not reset the original exchange's attempt total. Review local-context attempt treatment against current code rather than pretending all 16 are paid calls. There is no automatic retry, continuation or repair. A source-owned retry targets one stage without repeating its sibling or contact reply.
- **Deeper requests:** each explicit deeper request is new intentional work with its own logical request identity, admitted under the same global work rules and existing-style 16-attempt retry protection. Duplicate action IDs reuse the request; retries cannot turn into fresh requests silently. Repeated user requests are counted and metered as real new work, not treated as an automatic runaway loop.
- **Combined accounting:** associate all automatic and explicit deeper requests with their source exchange for cost/usage totals, while preserving their distinct logical request identities. The exchange's original 16-attempt budget is shared across its original flow and automatic children; each explicitly accepted deeper request adds its own bounded request budget. There is intentionally no fixed lifetime per-exchange inference maximum across unlimited new user-authorized requests. New IDs cannot reset a request's retry count or duplicate automatic stages. Unknown outcomes release active slots but remain in attempt/cost history; unknown cost never becomes zero.

Deferred work is bounded per retained source (one intent per automatic stage), not globally bounded database history. Fetch/promote eligible work in bounded batches and never materialize the full backlog in memory. Recheck source/archive/revocation/cancellation before promotion; never fetch latest mutable context, reopen primary pending, create a provider attempt before dispatch preflight, or rerun unknown work on restart. Hard source retention remains the existing product policy; do not invent silent old-turn discard to enforce an arbitrary queue number.

Use foreground priority and speech priority within helpers, with fair FIFO/eligible selection across automatic stages and explicit deeper work. An explicit deeper request should not sit behind an unlimited automatic backlog, using the smallest tested fair selection rule. Reliability/Integration can choose the smallest tested fair selection implementation. Priority does not preempt running requests or guarantee completion under saturation.

## Remaining choices before code

Settled: automatic dependency-split coaching, responsiveness first; learner feedback immediately eligible on saved learner/prior text; response help eligible on contact text; no edge between stages; independent hydration; shared machinery across difficulties; saved reuse and explicit deeper calls; helper-ceiling direction; private isolation. The no-contact case now naturally supports learner feedback while response help is unavailable.

Still to reconcile:

1. Language's two exact schemas: SIX categories, score range/anchors/unscorable state, source linkage, correction/suggestion counts, aggregate size, valid no-help and within-artifact partial evidence semantics. Scores/gamification validity remains separate.
2. Proactivity/composing-help controls under every-turn generation: presentation/content-volume policy versus any explicitly approved change in trigger, never hidden extra calls.
3. Verify reuse of existing 64-work/16-attempt accounting with deferred automatic intents, source-owned retry and independent parent reply state; choose the smallest fair eligible dispatch rule. No arbitrary lifetime deeper-request cap is needed.
4. Whole-exchange versus per-stage cancel controls, source-access versus assessment-only exclusion, and explicit deeper selection when one artifact is absent.
5. UI independent stage states, historical suggestions and draft insertion, coordinated with Interaction; no old result replaces current composer help.

Required local gates: sibling stage independence under success/failure; feedback starts without future reply; suggestions start without feedback completion; every required source's edit/delete/exclusion authority; private history isolation; duplicate intent and late result handling; cancellation/retry alongside speech; microphone and next-send admission with both stages queued/running; grouped sibling survival; all three route preflight; restart/unknown usage; malformed/duplicate/truncated outputs and per-stage token bounds. Review and source ownership precede implementation; paid synthetic evaluations need separate authorization.

Prior Code Quality reviews covered earlier proposal versions, not this newly split graph. Submit this revision for review with Language schema agreement explicitly pending.

## Reconciliation with Language and Reliability

Read Language's latest two-call section in `L1-coaching-contract.md` and Reliability's split lifecycle review. The graph agrees: source s0 learner feedback uses preceding context only; suggestion output uses actual contact text and never consumes feedback. Each schema is independently decoded and atomically published. Language proposes correctness outcomes `no_issue_identified | issues_found | insufficient_evidence` and understandability outcomes `likely_clear | recoverable_with_effort | likely_unclear | insufficient_evidence`. Those are not yet a numeric score rubric. The requested score display/scale remains a real Integration/user-design decision; this report does not silently replace that request with a settled qualitative-only product.

Language's proposed suggestion contract is available with 1–2 suggestions, or insufficient_context with no suggestions and a reason. Candidate target/explanation strings each cap at 160 scalars, reason 240, raw response 8 KiB. No contact text means no suggestion request at all, distinct from an accepted insufficient_context result. Feedback removes next_responses entirely; evidence binds to native source aliases/inclusive grapheme IDs, and multiple criteria may cite the same range. Skill evidence is not word-gloss segmentation. Its six-domain mapping is in `L1-six-skill-domains.md`; no invented categories or automatic credit added here.

Output-budget recommendation for discussion: retain Language's individual ceilings as defensive upper limits but add an aggregate generated-prose ceiling of 800 scalars for automatic feedback, targeting roughly 600 in the prompt, with at most 6 observed skill items and 2 compact help items. Suggestion aggregate generated text caps at 600 scalars across candidates/explanations/reason. Limit each axis/help item's source-reference list to 2 and feedback references to 20 overall; never force evidence in all six domains. These are proposed additional bounds, not proof of fitting every language into 2,048 tokens. JSON/reference overhead and tokenizer differences remain; max-token termination rejects atomically. Exact schema preflight and synthetic shape/size fixtures precede live quality evaluation. If a practical envelope does not fit, revise the single stage's approved budget or reduce compact content—do not add an automatic continuation/repair call.

Reliability's review exposed three important accounting distinctions now reflected above: admitted states must agree between durable state and permits; deferred intents are storage, not active queue capacity; and new operation IDs must not reset retry/cost history. Reuse existing protections and distinguish intentional new requests from retries. Any required change to how source-owned analysis participates in current admission/accounting needs explicit Integration assignment and regression checks before code.

Graph and provenance agree with Language's latest two-contract section and Reliability's split lifecycle review. Remaining material choices are score rubric/display and six-category/gamification review; compact schema limits; exclusion/cancel scope; and verification of fair admission plus independent primary/assistance state. Implementation ownership remains unassigned. No code or paid calls.
