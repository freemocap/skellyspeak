# Message assessment replacement

Status: implemented in source following acceptance of the scoring pilot. No deployment or commit. The installed application has not been relaunched as part of this change.

## Adopted behavior

- Grammar and conversational fit use anchored 0–10 choice questions, with explicit insufficient evidence represented as a null score. Zero is an assessed result, not missing evidence.
- Partner understanding uses a separate question: understood, partial, misunderstood, clarification requested, unclear, or no reply. These are evidence categories, not emotions.
- Both paths use the existing selected classifier and bounded decisions transport exclusively. No generative scoring fallback, former five-point bundle, inferred-emotion prompt, or result converter remains in these paths.
- The former automatic remark, correction and language-fragment fields are removed. Saved numeric results render directly. A learner can ask the coach for an explanation using the saved result and exchange.
- Complete validated choice distributions and confidence accompany the projected score/category. They are not calibrated proficiency probabilities. Request, response, usage, cost, timing and failure diagnostics retain existing execution ownership.
- These results do not publish skill evidence or grant XP. The separate skill evidence system is outside this message-score replacement.

## Graph

Context capture releases message ratings and the partner reply independently. Ratings receive the latest learner input and preceding partner message, including the selected language and variety; they never receive the later reply. Reply publication releases understanding alongside other reply-dependent work. Neither scoring nor understanding gates the reply or the other assessment. Opening turns without a learner message do not request these assessments.

The graph inspector uses the same declarations and authored choice questions. The classifier role is explicit. Shared admission, cancellation, revision checks, failure reporting, retry policy and transaction boundaries remain in use. Failure or late arrival does not create learning credit or overwrite a revised source.

## Sources

- `content/prompts/conversation/ratings.yaml`: the accepted pilot's wide-scale questions and understanding categories.
- `native/src/learning/coaching/message_assessment.rs`: input projection, bounded request and result validation.
- `native/src/conversations/turn_plan.rs`: dependencies and activation.
- `server/app/inference/decisions.py`: bounded admission for the two question shapes, retaining existing skill requests separately.
- Conversation feedback and partner reaction UI: ten-segment meters, unscored state, categorical understanding and on-demand explanation.

## Development data

The local current workspace was unlocked and passed schema identity, quick integrity and foreign-key checks. A one-time cleanup removed four retired assessment operations (and their owned attempt receipts) and cleared three old-format results. No conversations, messages, Drill data, credentials or skill records were deleted. Integrity passed afterward. No migration, alternate reader or automatic reset was introduced. Other workspaces containing retired results need explicit development cleanup before use.

## Verification

- Full native suite: 590 passed, 5 deliberately ignored live/environment tests.
- Relevant server decisions and grouped transport suites: 69 passed.
- Focused conversation UI and projection suites: 70 passed.
- Full UI suite initially exposed a pre-existing missing audio-settings localization key: 1,199 passed and nine settings tests failed. Added the missing translation across all seven locales; all nine settings tests passed after that correction.
- Strict frontend type checking, generated contract verification and native lint passed. Production frontend build passed (existing large-bundle advisory remains).
- Graph tests cover ratings publishing before reply, independent understanding, malformed-score failure isolation, no learning credit, durable reopening and rejection after source revision.
- Removed the obsolete ignored live test that exclusively exercised the retired generative feedback contract. The scoring study's frozen plans and receipt machinery remain available for live experiments.

The broader workflow audit's unrelated scheduling and hydration findings remain separate work. No new paid inference was required for this integration.
