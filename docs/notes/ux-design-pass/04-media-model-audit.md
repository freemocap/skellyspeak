# Audio ownership, analysis and retention audit

Follow-up: [implemented shared media and reading controls](05-shared-media-and-reading-controls.md) supersedes the pending-work status below; this note preserves the earlier review.

2026-09-28. Source audit and implementation proposal, not implemented behavior.
This qualifies the earlier verification in [03-shared-audio-review.md](03-shared-audio-review.md).
The user requested this architectural checkpoint before continuing the cache fix.

## Assessment

Execution caching already has shared infrastructure. Media ownership and derived
analysis do not yet have an equivalent shared lifecycle. Reusing the player and
spectrogram renderer does not establish reuse of retained audio or computed data.
The repeated loading is supported by actual repeated inspection calls; the reviewed
inspection component has no artificial minimum loading timer.

## Current implementation

| Concern | Evidence and behavior |
| --- | --- |
| Request results | `native/src/ai/results/` provides request identities, payload hashing, shared pending jobs, consumer associations, receipts and bounded retention. Speech, transcription and text helpers use this infrastructure. This is useful existing machinery, not three wholly independent caches. |
| Durable provenance | `native/src/storage/schemas/inference_results.sql` separates execution metadata from evictable payloads. Receipts survive payload eviction. Preserve this distinction. |
| Generated audio | `native/src/speech/alignment.rs` serializes WAV bytes as base64 with optional character alignment in a retained response. The inference blob digest identifies the whole response payload, not an independent audio asset. |
| Captured audio | Practice retains attempt WAV files through `native/src/drill/mod.rs` and `retention.rs`, with its own capacity, pruning and orphan reconciliation. Chat's currently exposed recording audio is held in transient UI state. These do not constitute a common media repository. |
| Recognition evidence | `native/src/speech/recording/results.rs` saves transcript/timing with the exact WAV digest and rejects timing for different bytes. Product evidence survives request-cache eviction. This is intentional, useful separation from a reusable response cache. |
| Spectral analysis | `native/src/speech/analysis/audio_inspection.rs::inspect_wav` decodes WAV and computes waveform, activity and spectrogram on each invocation. Its response combines signal data, recording identity, feature owner and word timing. No retained derived-analysis lookup exists in this path. |
| Practice hydration | `ui/src/features/drill/useAttemptAudio.ts` reads WAV and calls inspection again on selection/retry. `DrillPage.tsx` also inspects loaded/generated reference audio. Its inspection map supplies history display; it is not the lookup used by these loading paths and is cleared on item changes. |
| Chat hydration | `MessageSpeechInspection.tsx` owns analysis in component state; closing unmounts it and reopening requests inspection again. `useMessageSpeech.ts` holds only the latest loaded reply audio. |
| Presentation | The two surfaces now reuse media rendering, playback and scrubbing primitives. Their data loading and lifetime are still separate. |
| Service boundary | The reviewed `server/app/inference/audio_service.py` handlers return synthesis bytes/alignment or transcription text/timing with usage. They are execution adapters, not the local retained-media owner. This audit is not a complete server persistence/security review. |

## Concrete defect in the recent Chat wiring

`application/commands/workspace.rs::inspect_message_speech` calls `speech_audio`
again after the playback hook has read it. In `conversations/execution/speech.rs`,
that read uses the retained inference result when present, otherwise consumes
`speech/delivery.rs::DeliveryBuffer::get`. The delivery buffer is explicitly a
bounded one-time mailbox, not a reusable cache.

Consequently, with response retention disabled or the payload evicted, playback
can have the WAV while inspection reports it expired. The recent adapter is
incomplete. Do not fix this by making the delivery mailbox an unbounded cache.
Playback and inspection must resolve the same live audio resource, including its
valid transient lifetime when durable retention is disabled.

## Proposed shared model

The three request categories remain distinct typed operations. Their shared
execution bookkeeping should not require flattening their inputs and outputs
into one permissive record. Share the artifacts they consume and produce:

1. **Audio asset:** immutable bytes, content digest, encoding and measured audio
   metadata. Captured and generated audio use the same physical representation.
   Capture/generation origin belongs in provenance, not separate byte stores.
2. **Signal analysis:** waveform, spectral data and local activity analysis keyed
   by audio digest plus analysis algorithm/configuration revision. It contains no
   Chat message, Practice item or transcript identity. Changing text annotations
   must not rerun spectral analysis.
3. **Text/timing annotation:** recognized transcript or synthesis source alignment,
   linked to the exact audio and originating execution. Preserve original text,
   provider timing, unsupported intervals and diagnostics. Generated alignment is
   not recognition evidence; estimated playback highlighting is neither.
4. **Consumer reference:** message, recording attempt or Practice reference links
   to an asset and applicable annotations. Removing one consumer must not remove
   media still retained by another. Ownership checks remain at the consumer boundary.

These are responsibilities, not a demand for four new services or frameworks.
Extend the current native ownership and retention mechanisms where possible.

## Lifetime and cleanup requirements

- Retain computed signal analysis with retained audio. Closing an inspector,
  changing tabs, revisiting an item or updating timing must not recompute it.
- Concurrent requests for the same audio/configuration share one pending analysis.
  Failed analysis is reported and explicitly retryable, not cached as success.
- Keep an active playback/inspection resource usable through its transient
  lifetime even if persistent response caching is disabled.
- Bound and account for derived data as well as bytes. One cleanup implementation
  may support different retention policies for captured recordings and regenerable
  speech. Equivalent media representation does not require identical retention.
- Remove derived data when its audio is no longer retained or actively held;
  preserve product evidence and content-free execution receipts according to their
  existing ownership. Reconcile interrupted deletion explicitly.
- Session/workspace changes must invalidate hydrated resources. Content identity
  is not authorization to inspect another consumer's records.
- Recalculation is legitimate after an analysis revision or after actual media
  eviction and later reacquisition. A visibility toggle is not eviction.

## Implementation order and acceptance checks

1. Separate signal analysis from owner/timing composition within the existing native
   speech modules. Introduce shared audio identity and derived-result retention;
   route capture, generated speech and Practice reads through it. Avoid a competing
   cache per component or tab.
2. Replace the second consuming Chat read and feature-local inspection loaders with
   one shared resource path. Preserve feature authorization and diagnostics.
3. Complete pending UI changes: inspect panel above its controls; preserve the
   clicked control's viewport position across toggle; remove score dots while
   retaining Grammar/Conversation fit labels and numbers. Merely changing DOM
   order may still move the control and requires an interaction check.
4. Test analysis invocation counts across close/reopen, tab and item changes,
   concurrent consumers and timing changes. Test disabled retention, eviction
   during playback, shared-owner deletion, workspace changes, failed analysis and
   retry, and stale analysis revisions. Verify both generated and captured audio.
5. Verify real native playback/inspection and both responsive layouts before
   calling the branch ready. Optional explicit retranscription should reuse the
   same asset and execution path; it remains a separate user action.

No storage reset, contract refactor or cache implementation was performed during
this audit. The earlier passing suites verify the earlier wiring, not these
proposed lifecycle guarantees. Findings above are source-traced; no new runtime
or automated verification is claimed. No commit or publishing action was taken.
