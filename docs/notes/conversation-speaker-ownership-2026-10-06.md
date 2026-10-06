# Partner-first conversation speaker ownership

2026-10-06. Investigation and implemented mitigation; verification below.

## Observed failure

The reported first reply attributes the partner's own opening situation to the
learner. The retained streamed text, retained completion and published message
agree for this incident. This is a failure in the generated conversational content,
not merely duplicate UI rendering. Private conversation text and prompts are not
copied into this repository note.

The historical attempt records Gemini 2.5 Flash Lite through OpenRouter's Google
provider. Its locally captured history is `system, assistant, user`, with the
learner's actual question last. The capture is persisted when dispatch is prepared;
inspection reads that saved record, rather than regenerating it using today's
prompt. It is still a pre-transport record, not evidence of the upstream model's
final interpreted conversation.

## Controlled replay

With explicit user approval, six direct OpenRouter requests replayed the saved
prompt and conversation: three unchanged and three with one initial user-role
application instruction before the first assistant message:

> Begin the conversation as the partner described in your instructions.

The model, temperature (1.1), disabled reasoning and provider routing requirements
were held constant. All six returned the Google provider. Trials used non-streamed
responses and a 256-token output cap, versus streaming and the application's
2048-token cap in the original incident. No trial reached the experimental cap.
They bypassed the native application and hosted relay, isolating the behavior
outside those components. Calls used concurrent execution, not deterministic seeds.

Two of three original-shape responses explicitly treated the partner's situation
as the learner's. The third answered the question without that clear role reversal.
All three initialized-history responses answered without that reversal. Original
inputs used 1051 prompt tokens; initialized inputs used 1062. Combined reported
cost was USD 0.0007103.

This reproduces the failure outside our UI/relay and supports initialization as a
targeted mitigation. Three samples per condition do not establish a universal
success rate. We cannot distinguish OpenRouter's provider conversion from Gemini's
interpretation: neither's internal final input is visible in these receipts.
Do not describe a provider-side role rewrite as proven.

## Why earlier checks can give false reassurance

- Correct locally saved roles establish application intent, not upstream
  interpretation. Native capture precedes HTTP serialization; our server also
  applies request settings before forwarding to OpenRouter.
- The existing assistant-first server regression uses a mocked upstream returning
  a hand-authored correct answer. It checks forwarding and result ownership, not
  model comprehension of that history shape.
- Publication can extract the first assistant segment from a role-labelled model
  transcript and then validate the cleaned text. A successful status and displayed
  text therefore do not imply the model originally produced one valid reply.
  Raw completion text is separately retained. No such cleanup occurred in this
  incident; it must not be presented as its cause.
- Prose validation checks structural validity, not whether plans and experiences
  remain with the correct speaker. A semantically wrong reply can pass.
- Retained streamed frames redact content, and the native completion is assembled
  from first-choice deltas. The readable completion is not a byte-for-byte network
  capture. Successful publication alone does not verify every transport boundary.

## Implemented mitigation

New partner reply contexts whose first retained history message is assistant-role
now receive the tested application instruction before that message. The instruction
is editable shared content in `content/prompts/conversation/history-start.md`.
It is captured before dispatch, so stored request inspection and outgoing provider
messages include the same initialization. Prompt version 42 identifies the change.
There are no model, language or script conditionals.

This instruction is provider-facing request framing. It is not inserted into the
messages table, source IDs, learner evidence or visible chat. Learner-first history
and coach dialogue keep their existing framing. The selected history window decides
whether initialization is needed; long conversations do not keep adding synthetic
turns. The existing byte limit remains, with room for one extra framing message in
context validation. Partner opening generation itself is unchanged.

Saved historical attempts and accepted messages remain intact. New replies in
existing conversations use the new capture behavior; already-captured pending work
keeps its historical input. No SQL schema or persisted contract migration is needed.
The transcript-cleanup policy is unchanged and remains a separate concern.

## Verification

Final verification passed: fast validation; Clippy for library and tests with
warnings denied; authored-content validation (21 languages); and the full native
library suite (834 passed, five existing ignored, zero failures). Documentation
entry-point link validation and whitespace checks scoped to this change passed.
The repository-wide whitespace check separately reports an existing extra final
blank line in `ui/src/styles/components/fields.css`; that unrelated edit was left
untouched.

The existing assistant-first mocked server regression passed unchanged. Pytest
reported an inability to write its local cache, without affecting the test result.
This pass is evidence of relay forwarding only, not model compliance.

The development executable rebuilt at 08:31:54 America/New_York and its process
restarted at 08:31:55, after the implementation edits. A fresh conversation through
the running UI has not been exercised in this investigation. No further live model
calls beyond the six approved replays were made.

### Follow-up: observed application request

A subsequent read-only inspection found a real learner follow-up in the reported
conversation at 08:30:51 America/New_York, after the behavioral source edit and
before the later rebuild noted above. The saved turn declares prompt version 42,
and both its captured context and attempt request contain the initialization
instruction. The partner answers the learner's new food-choice question coherently.
Retained streamed text, raw completion and published message are identical; this
successful response was not produced by transcript cleanup.

This verifies that the initialization reached the running application's request
capture/dispatch path, beyond the standalone experiment and deterministic tests.
It is one observed follow-up containing the earlier failed exchange, not a fresh
first-reply reproduction or evidence of a measured long-run failure rate. No new
provider requests were issued by this follow-up inspection.

Regression coverage follows both partner-first and learner-first conversations
through 22 learner turns, crossing the 40-source context window. It compares source
IDs and original Unicode text with capture, dispatch serialization and retained
attempt inspection, and checks that initialization creates no learner message.
Existing opening/revision coverage checks initialization with edited learner input.
These deterministic tests establish application wiring, not model behavior; the
six live trials above are the separate behavioral evidence. No deployment or commit
is authorized or performed by this investigation.
