# Transcription quality investigation

Status: observed regression reported by the user; cause unresolved. The user
clarified that the written transcript is wrong. This is distinct from the earlier
speech-synthesis protocol failure. No runtime settings or provider routing were
changed during this investigation.

## Evidence

Read all JSONL streams in the three runs beginning after the latest source
checkpoint, including successful events. Inspected local transcription receipts
through a read-only database connection and measured saved Drill WAV files without
modifying them. No recordings were sent for additional inference.

- The active run contains 27 completed transcription receipts after 23:21 UTC:
  12 chat and 15 Drill. All report successful transport/publication. Successful
  publication does not certify that recognized words match the speaker.
- All requested the same configured transcription model on the hosted route.
  Returned actual-model metadata is unavailable; requested model is not proof of
  an immutable upstream implementation.
- Nine of 15 Drill results were rejected by the existing low-confidence gate;
  six were accepted. The retained confidence score is not an accuracy percentage.
- Three late Spanish chat requests have confidence summaries around 0.43, 0.47
  and 0.52. Arabic chat also includes uncertain results. Chat auto-send occurred
  12 times and has no corresponding Drill confidence gate.
- One Spanish response supplied word timing beyond the recording duration. The
  timing validator correctly marked it unavailable while preserving the transcript.
  That timing defect alone does not explain incorrect words.
- Fourteen inspected saved Drill clips were mono 48 kHz, 0.64–1.08 seconds long,
  with durations matching their service receipts. Two had samples near full scale
  (about 0.11% and 0.28%); most had none. This does not establish audible quality,
  correct microphone positioning or the absence of clipping at an earlier stage.
- The selected microphone is a named device. A microphone-selection save occurred
  during the session; the logs do not retain the prior device selection.
- The inspected PCM encoding, recording-owner language/context construction and
  transcription wire adapter show no behavioral change from the earlier deployed
  source baseline. The cache-refactor recording changes redirected configuration
  lookups; no transcription-result cache was added.
- The separate reading failure now explicitly records cancellation after dispatch.
  It concerns generated text and does not establish a transcription failure.

## Limits and next evidence

Logs intentionally redact transcript content and cannot establish what the speaker
actually said. Saved Drill audio can support a controlled comparison; chat capture
is not durably retained in the same way. The recognizer receives contextual text
from the conversation or Drill item, so context influence is a hypothesis to test,
not a demonstrated cause or permission to change recognition policy.

The user directed investigation of the existing records rather than supplying
another example. Read the saved chat messages and Drill transcripts directly;
their contents are deliberately not copied into this public working note.

Additional findings:

- One Spanish chat recording completed at 23:31:01.199 UTC and was published as
  an English sentence at 23:31:01.259 UTC, followed by a partner response to that
  sentence. Its receipt has four recognized words and confidence about 0.468.
  The stored conversation is Spanish; current owner resolution selects its
  language tag. Request language and raw response text are not retained in the
  receipt, so that selection cannot be retroactively proved from the wire log.
- Successive Arabic chat messages contain varying recognized spellings. The
  partner then interprets and responds to those spellings, compounding the visible
  problem. Source inspection finds no intervening translation or transcript cache:
  native publication returns the recognizer text, the recording hook verifies the
  owner/id, and chat passes the returned text to send.
- Of 15 repeated Drill attempts, ten matched under the existing matching rules:
  five accepted, five withheld for low confidence. Five had a one-grapheme
  difference: one accepted, four withheld. Thus the nine low-confidence decisions
  are not nine demonstrated recognition errors or pronunciation mistakes.
- In particular, matched text is being withheld by the independent confidence
  gate, while uncertain chat text is auto-sent. These are different product
  behaviors; changing a confidence threshold would not fix recognized words.

The recognition-quality cause is still unresolved. Correlation and source tracing
narrow the issue but cannot reconstruct unretained spoken chat audio. Continue
with saved recordings and explicit local comparisons rather than claiming that
confidence scores alone diagnose the regression. Any replay must
be explicit about local processing versus transmitting a recording for inference.
Do not change the deployed server or introduce language-specific fixes.
