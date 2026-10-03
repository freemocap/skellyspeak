# Conversation reply emitted protocol role labels

## October 1 follow-up: recover the assistant turn

Implemented in source at the user's request. This supersedes the rejection-only
policy described in the September 30 report below. Verification is recorded below;
these changes have not been installed or checked in a running application.

Read-only inspection of the latest desktop Spanish conversation with Lucía found
one opening and one learner/reply exchange. The reply's retained response, stream
preview and saved message were identical: an assistant role header and answer,
then a user role header and an invented learner continuation. The captured request
had correctly separated system, assistant and user messages, with no transcript
labels in the history text. The provider reported normal completion.

Correlated preparation and validation events identify the running build as 2.9.4.
Its captured instructions predate the September 30 source changes below: the
longer interaction block, raw persona/practice metadata and older continuation
instruction were still present. The previous source fix therefore was not active
in this desktop attempt. The decoder reads content deltas; it does not prepend
role fields. This supports generated transcript spillover rather than UI insertion.

Hypotheses, not established causes: explicitly discussing protocol roles may cue
transcript formatting; long background/practice metadata may weaken adherence to
the output constraint; sampling variation may contribute (recorded temperature
1.1). No controlled generation comparison was performed and no sampling setting
was changed. Existing source prompt improvements remain in place.

Inspection covered the local desktop database's captured request, response,
preview, published messages and receipt, plus all records in locally available
JSONL streams modified since the affected conversation began: 1,725 frontend and
747 native records, with no malformed records. The correlated response completed
normally and validation accepted it. Cloud logs and device data were not read.
Private conversation content is not reproduced here.

### Recovery behavior

For normally completed conversation openings, partner replies and coach replies,
a response beginning with protocol role labels can be recovered by retaining the
first assistant turn. Its label, any preceding labeled turns and every following
turn are discarded. Internal whitespace and Unicode encoding are preserved.
The recovered message passes ordinary validation and is the source for stored
conversation text, speech and derived assistance. Structured outputs are excluded.

The original response, stream preview, provider receipt and token usage remain in
attempt inspection. A content-free `conversation_role_transcript_cleaned` warning
records attempt/operation identifiers and removed byte count. Cleanup metadata
also survives in the attempt diagnostics. No warning banner or failure is emitted
for a recovered reply. Streaming previews still reflect the original stream;
cleanup happens when the completed response is published.

Missing/empty assistant content, ambiguous prose preceding a transcript, invalid
prose and incomplete/provider-error responses retain existing failure behavior.
Ordinary prose and quoted role words are unchanged. Existing saved history is not
rewritten; the cleanup applies to newly completed attempts.

### Verification

Final checks passed: fast repository validation, native formatting, Clippy with
warnings denied, all native library tests (771 passed, 5 ignored), and binary
compilation checks. Regression coverage exercises scripts and
canonical encodings, multiline prose, later invented turns, absent/empty replies,
incomplete/error completions, original response retention, diagnostic redaction,
successful publication and the exact cleaned speech source.

## September 30 report (historical rejection-only behavior)

Status: traced on the Android device, source fix implemented, targeted native
tests passed. Updated Android debug APK built, installed successfully and opened
on the reconnected phone. The user reports that the updated conversation looks
good. No commit or release.

## Evidence

The latest Spanish conversation contained a partner message beginning with an
`assistant:` header, followed by a `user:` header and a copy of the learner's
preceding turn. The retained response and stream preview exactly matched the
saved message. The retained request used separate, correctly ordered system,
partner, and learner messages; it did not serialize those roles into the prose.
The response completed normally according to the retained finish metadata.

The service's stream accumulator appends only content deltas, and the client
decoder retains the returned content. No role-prefix insertion exists in that
path. This supports a malformed generated response, not a bubble rendering or
audio defect. It does not establish why that particular generation ignored the
existing no-label instruction.

The existing prose validator accepted any nonempty, bounded text without null
characters. That allowed the generated transcript to be published and passed to
speech and reading assistance as though it were one partner message.

Inspection used the app's scoped conversation and attempt commands. Conversation
content and request bodies are intentionally not copied into this public note.

## Relationship to speaker attribution

This continues [the speaker attribution investigation](conversation-speaker-attribution-2026-09-30.md).
The latest failure happened with the earlier continuity instructions already installed.
Correct local message roles do not prove correct semantic interpretation upstream.
Both observed symptoms are consistent with confusion about who should speak, but
there is no controlled generation result establishing a single common cause.

The captured system prompt also contained raw persona and practice-selection JSON.
The latter included catalog identities, selection policy, experience counts and
assessment guidance. That material was unnecessary for composing a partner reply
and competed with the conversational task.

## Implemented behavior

- Persona background and topics use readable quoted text. Stable persona sampling
  and the original source text are preserved.
- The partner receives only the practice name and overview. Selection provenance
  remains captured in the turn; assessment instructions remain owned by assessment.
  The brief practice section precedes the conversation task and difficulty limits.
- Repetitive conversational instructions are shortened. Difficulty, language
  guidance, history roles, temperature and concurrency are unchanged.
- The shared next-message instruction now explicitly requests exactly one
  partner message, with no role headers, transcript, message objects, copied
  learner turn, or invented learner continuation.
- Conversation publication rejects protocol role headers at the beginning, or
  multiple role-header lines in the remainder. The identifiers belong to the
  message protocol; this policy is independent of the target language.
- The original response, preview and response metadata remain inspectable.
  Validation adds a structured stage, path, reason and expected shape. Rejected
  text is not published as a conversation message or admitted for speech.
- The response is not silently trimmed: removing labels cannot repair a
  mistaken conversational meaning. Existing explicit failure/retry behavior
  applies. Existing saved messages are not rewritten.

## Verification

Two validator tests cover protocol transcripts across scripts, canonical
combining characters, ordinary prose and quoted role terms. Nine retained-response
publication tests passed, including the new regression proving that the original
response and receipt survive rejection while no partner message or speech work
is published.

The conversation suite initially passed 184 tests with four intentionally ignored;
two assertions still expected old prompt wording. All six opening/history tests
passed after those assertions were updated. The readable practice projection test
passed, including omission of internal metadata, preserved captured data and
explicit failure on missing required fields. All 15 service delta tests passed,
including exact role/order forwarding and exclusion of role-only stream deltas
from spoken prose. Fast repository validation passed. The user subsequently checked the installed build and reported that it looks
good. This is a device smoke check, not a controlled generation-quality comparison.

Android build completed after a disk-space failure was resolved by deleting only
regenerable native compilation caches. After USB reconnection, installation
succeeded and the app was opened. Installation and launch succeeded; the user subsequently reported a successful
conversation smoke check.

## Local patch build

At the user's request, the package manifest and lockfile were advanced to 2.9.5.
The Android debug APK was rebuilt, installed over the existing app and opened.
Android reports versionName 2.9.5 and versionCode 2009005. Commits, tags and
release publication are left to the user; none were performed.
