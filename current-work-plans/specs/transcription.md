# Spec: Transcription (streaming, word-timestamped, code-switch aware)

## Purpose
Turn an utterance into a word-timestamped transcript, handling mixed-language speech.

## Implementation
**VENDOR Handy's `transcription_coordinator.rs` + `managers/transcription.rs`**
which drive `transcribe-rs` (ONNX: Parakeet) and `transcribe-cpp` (GGML: Whisper).
We do not write the STT drivers ourselves.

## Behavior
- Word timestamps are the hard requirement (they feed word-alignment).
- Code-switching (spike): multilingual Whisper vs whatlang/isolang routing vs glossary bias.

## Acceptance criteria
- [ ] Word timestamps populated (confirm transcribe-rs granularity).
- [ ] Mixed shared+target language transcribes correctly (spike decides how).

## Test plan
Spike scripts on real audio (Jon's machine). Unit: model-capability probing, run-option building.
