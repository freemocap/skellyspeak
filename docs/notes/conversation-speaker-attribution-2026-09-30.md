# First-reply speaker attribution investigation

Status: observed failure investigated; prompt continuity wording subsequently
updated as requested. Behavioral effectiveness has not yet been measured.

## Incident and evidence

The partner's opening establishes a weekend plan. The learner says their own
weekend plans are undecided. The next partner response reacts to the partner's
original plan as though the learner proposed it, then gives a contradictory plan.
Private conversation text and persona details are intentionally omitted here.

Local correlation identifiers:

- Conversation: `8d15a0c7-cfbb-421e-bdd0-957ef7502aee`
- Opening turn: `168d6443-1505-43b7-9550-51f0df31f976`
- Reply turn: `c0cf34f2-09a1-43a9-90c3-f1bfd89483eb`
- Reply operation: `2d529aad-509a-4654-aecf-0eb07ea9066f`
- Attempt: `1790771211-cce246a8c7c54ad3879f40dd97c0a3a7`
- Request started: 2026-09-30 12:26:51 UTC
- Native run: `native-7e85b6ed-e40b-48f9-8cf2-31346c6f1359`

Read the active workspace database using SQLite read-only mode. Compared message
rows, both captured turn contexts, and the reply attempt's saved request,
response, preview and diagnostics. The reply request has exactly this order:
system instructions, partner opening with role `assistant`, learner reply with
role `user`. The captured turn and attempt agree. The source ID identifies the
opening. The learner's current text is appended separately, as intended.

The saved response, streamed preview and published partner message contain the
same incorrect response. This rules out a display-only mix-up for this incident.
The attempt succeeded; its normal stop has 20 output tokens, with no token-limit
truncation. The preparation event records three messages, 3,292 prompt bytes,
temperature 1.1 and captured content matching the running build. Native validation
accepted the response; this is not evidence of semantic consistency.

Read every JSONL record in both native and frontend diagnostic streams of the
identified run, including successful records. The native stream contained 18
preparation and 18 validation events, plus two speech validation events. The
frontend diagnostic stream contained 499 records at inspection time. Other local
runs were inventoried but not exhaustively audited. Hosted service logs and an
upstream wire capture were not available in this investigation.

## Source path reviewed

- `native/src/conversations/execution/turns.rs`: selects history with stored
  roles, restores chronological order and appends the current learner message.
- `native/src/conversations/execution/dispatch.rs`: reads captured messages for
  the partner reply and retains them on the attempt.
- `native/src/ai/transport/provider/payload.rs`: serializes those messages into
  the request; dispatch settings supply the effective temperature.
- `server/app/inference/grouped.py` and `contracts.py`: validate request shapes
  without relabeling or reordering messages.
- `server/app/main.py`: forwards the contract payload; streaming changes stream
  options without changing message ownership.
- `native/src/conversations/execution/publication.rs`: retains returned text
  before publishing it to the active turn.

Current source review finds no role reversal in this path. It does not prove the
deployed service revision or reveal the upstream adapter's internal message
conversion. The precise internal cause therefore remains unresolved. Evidence
locates the observed failure in returned generation content after correct local
request assembly, rather than in local history selection or display.

## Hypotheses and focused next experiment

The captured prompt already explicitly says earlier partner messages belong to
the partner. Adding that same instruction again is not a demonstrated fix.

However, shared interaction instructions still say to start directly, contribute
a detail and ask a question on follow-up turns. The selected topic also continues
to instruct the partner to ask about the weekend and share a plan. These can
compete with conversational continuity. Temperature 1.1 is another experimental
variable, not a proven explanation.

Use the saved request as a private reproduction case. Compare repeated baseline
generations with a shared, language-independent continuation prompt that explicitly
maps roles to speakers and scopes opening directives to openings. Separately vary
sampling and compare partner-started with learner-started histories. Evaluate
ownership of each stated fact, consistency with the partner's prior plan and
response to the latest learner message. Do not treat one successful retry as a
fix. Verify the deployed outbound role sequence before claiming an internal
model error rather than an upstream conversion issue.

No private transcript was added to repository fixtures, no inference was purchased,
and no application data, runtime source, deployment or Git commit was changed.
This describes the initial investigation; the subsequent source change follows.

## Implemented prompt adjustment

The shared conversation prompt now describes an ongoing exchange. Instructions
to start directly and contribute an opening detail/question live only in the
opening block. The response block explicitly maps message roles to speakers,
asks for a reply to the latest learner message in context, preserves ownership
and consistency of stated facts, and gives the learner's direction priority over
repeating the selected topic's opening task. The request version is now
`conversation-39-continuity`. Sampling settings are unchanged.

Updated the existing multilingual composition test for the new shared wording
and to check that opening and continuation instructions remain scoped correctly.
`inspect-content --check` passed for all 18 languages; `node tools/check-languages.ts`
passed. The focused native prompt test command could not compile because of an
unrelated unsized message collection in `execution/tests/model_comparison.rs:63`.
That concurrently added test was left untouched. No live generation comparison
has been run, so this is a prompt adjustment to evaluate, not a verified cure.
Rebuild/restart the native app to load the bundled wording for subsequent turns;
already captured attempts retain their original prompts.
