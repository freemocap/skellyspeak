# Speech and word-gloss investigation

Status: read-only investigation, 18 September 2026. No provider calls, deployment,
credential edits or application-data changes were performed.

Reviewed all JSONL streams in the available native run (started 16:24 EDT) and
local-server run (started 16:26 EDT), including success event counts and failures,
plus read-only durable transcription/operation receipts and saved reading results.
Cloud Logging was not queried; hosted evidence below is the client's retained
service/provider response metadata. Raw recordings are not retained in these logs.

## Findings

- Hosted transcription failed at 16:25:35 and 16:27:38 EDT with ElevenLabs HTTP
  401, `missing_permissions`, specifically `speech_to_text`. Successful hosted
  transcriptions followed at 16:28:29 and 16:28:50. This supports the user's report
  that the key permissions were corrected.
- All seven successful transcription receipts report Spanish (`spa`) or Arabic
  (`ara`) matching the conversation, with language probability 1.0. This reported
  value is not a guarantee of accurate words, nor proof of independent detection
  when a language hint is supplied. Spanish misrecognitions occur on both hosted
  and local/custom routes, using `scribe_v2`.
- Saved learner messages confirm the reported SBN/ESPN misrecognitions. Other
  Spanish utterances and the Arabic utterance were recognized plausibly. The bad
  samples span roughly 1.95–3.82 seconds. No evidence establishes an English
  override, microphone corruption or a GCP-specific cause.
- Source inspection: recording captures the selected target's language tag;
  Spanish is `es`. Multipart carries `language`; the server passes it through as
  ElevenLabs `language_code`. Native capture writes the actual sample rate into a
  mono WAV. Server decoding resamples to 16 kHz; the provider adapter wraps those
  samples in a 16 kHz WAV. No obvious sample-rate mismatch was found. Listening to
  the actual captured audio and a controlled same-audio provider comparison are
  needed to distinguish acoustic capture issues from recognition behavior.
- The saved partial Spanish word-gloss result at 16:24:59 has translations for
  every word. Its only unresolved source character is the final question mark.
  The partial status is thus punctuation coverage, not missing lexical translation.
- A separate Arabic persona word-gloss result at 16:31:04 was rejected with
  `gloss_whitespace_target; span 1`. No new word meanings were saved for that result.
- Three conversation-feedback failures are separate: two invalid/duplicate
  corrections and one upstream Gemini 429 embedded in a response, surfaced as an
  incomplete/oversized response. The detailed 429 metadata was retained, but the
  summary is misleading. Local HTTP 200 / delivered-result counts alone therefore
  do not establish successful validated inference.

## Follow-up status

The user subsequently approved word-gloss recovery and bounded background repair;
see [implementation and verification](word-gloss-recovery-2026-09-18.md). Speech
recognition remains deferred. The recommendations below record the investigation's
original next steps; provider-error classification is also still separate work.

Use the existing recording inspection/playback surface to compare heard capture
against transcript, then compare the identical short recording through another
recognizer if needed. Do not insert the expected sentence as a bias or post-correct
learner speech: that would conceal the recognition issue and alter learning evidence.
Review punctuation coverage presentation and whitespace-only gloss validation
separately. Preserve upstream provider errors in the primary failure classification.
