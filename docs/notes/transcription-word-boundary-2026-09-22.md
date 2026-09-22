# Transcription adapter word-end boundary

## Observed failure

The iPad reached Groq whisper-large-v3 and received HTTP 200. The hosted adapter
converted that success into AUDIO_RESPONSE_INVALID/HTTP 502 at words[2], because
its final word ended at 1.82 seconds while the audio duration was approximately
1.7627 seconds. No raw transcript or recording was copied into these notes.
The audio upload, shared PCM conversion and upstream request succeeded; this
failure is in response timing validation, not device capture.

## Superseded approach

An initial local patch allowed 100 ms of word-end overrun and clamped that end.
That patch was not deployed and is superseded. Increasing an arbitrary threshold
still let optional alignment discard a usable transcript; it did not fix the
underlying coupling.

## Implemented locally

Groq and ElevenLabs now return usable transcript text independently of optional
word timing. If timing cannot be used, the response succeeds with timing marked
unavailable. Original non-content provider metadata and a bounded diagnostic
reason/path remain available. Valid timing is preserved unchanged; no timestamp
is fabricated or clamped. Missing language/confidence fields do not gate text.
Native transcription adapters follow the same rule. Neither transcript text nor
accounting provenance is rewritten. No retries added.

The existing common audio input is mono signed 16-bit PCM at 16 kHz. Provider
adapters own model/language fields and response normalization. Shared input alone
does not guarantee arbitrary provider compatibility; providers need tested
adapters. This patch covers the two current hosted transcription adapters.

## Verification and release status

See the [provider-success validation audit](provider-success-validation-audit-2026-09-22.md)
for current verification. Regression tests cover the original overrun, larger
overruns and malformed timing while retaining successful text, diagnostic metadata
and accounting. No live provider requests were made by tests.

Not deployed. No commit created. The live service still rejects this case until
explicitly authorized deployment. The hosted Groq fix needs a server deployment;
the broader native adapter changes also need a new app build.
