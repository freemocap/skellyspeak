# Conversation emoji cleanup

Implemented in source; not verified in a running application.

The conversation prompt explicitly forbids outputting emojis, including persona
vibe symbols (prompt version `conversation-17`). Partner openings, partner replies
and coach prose remove whole emoji graphemes before publication. Published text
is also the source for speech, reading assistance and subsequent conversation
history. Structured response validation remains unchanged.

Cleanup emits a content-free `prose_emojis_removed` warning with attempt/operation
identity and a removal count. Attempt diagnostics retain the cleanup count alongside
provider metadata; the original response and stream remain in attempt inspection.
No user-facing warning is added. Empty-after-cleanup, invalid, oversized and
unfinished responses still fail their existing checks.

Verification: emoji-sequence unit coverage includes joined families, skin tones,
flags, keycaps and flag tags, alongside preservation of multilingual text and
ordinary digits. The opening publication regression verifies successful publication,
original-response retention, cleanup metadata and cleaned subsequent history.
Content/language validation and generated-contract checks passed. No live provider
request was made.

Final checks: 113 conversation execution tests passed (one existing ignored test),
28 configuration tests passed, emoji cleanup unit test passed, Clippy passed with
warnings denied, and formatting of changed Rust files plus `git diff --check`
passed. Local mock-server tests required execution outside the network sandbox.

## Opening instruction follow-up

Implemented `conversation-18`: require one concrete detail, opinion or small
situation followed by one easy question about it. Use the selected topic, otherwise
persona background, otherwise an everyday situation chosen by the partner. Explicitly
forbid offers of assistance, asking the learner to choose the discussion, and generic
opening greetings/check-ins. The existing difficulty and emoji rules remain.

Verification: language/content checks (including 28 configuration tests), generated
contracts and the production preview/captured-opening equivalence test passed.
This verifies request construction, not live model compliance.

## Absolute Zero difficulty follow-up

The observed `conversation-18` Absolute Zero opening contained five sentences,
including a job title and location. Its difficulty instruction had no sentence or
length bound, while Beginner did; the shared opening also required a statement
plus a question at every level.

Superseded by `conversation-20` below. Implemented `conversation-19`: Absolute Zero uses one tiny utterance with one clause,
aiming for 2–5 words and at most 7 in space-delimited languages (equivalent brevity
otherwise), with basic concrete vocabulary. Openings use a yes/no or two-choice
question without an introductory statement. Both difficulty and opening prose state
this exception. The shared ceiling explicitly prioritizes difficulty limits over
persona, topic and turn instructions. No automatic truncation or new response
rejection was added. These are prompt requirements, not a guarantee of model compliance.


## Natural Absolute Zero sentences

Implemented `conversation-20` after user review rejected the arbitrary word limit.
Absolute Zero now requests one short, natural sentence using very basic everyday
vocabulary and one concrete idea. It explicitly preserves complete grammatical
sentences rather than fragments. Openings request an easy concrete yes/no or
two-choice question without an introductory statement. Both the difficulty and
opening instructions use this wording; no numeric word limit remains.
