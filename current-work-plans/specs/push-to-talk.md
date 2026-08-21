# Spec: Push-to-talk coordinator (conversation-partner glue)

## Purpose
Tie Handy's capture + transcription to our translation + tutor so a PTT press
produces: word-timestamped transcript → word-aligned translation → tutor reply.

## Flow
1. PTT press → `AudioRecordingManager::try_start_recording`
2. PTT release → `AudioRecordingManager::stop_recording` → `Option<Vec<f32>>` PCM
3. `TranscriptionManager::transcribe_detailed` → `transcribe_cpp::Transcript`
4. `transcription_adapter::from_transcribe_cpp` → `skellysubs_core::Transcription`
5. `skellysubs_core::translate_utterance` (LLM) → word-aligned translation
6. tutor reply (LLM) → emit to frontend

## Key finding (word timestamps)
Handy's `transcribe()` returns text only (dictation doesn't need timing). We
added `transcribe_detailed()` (Whisper/transcribe-cpp only for now) that keeps
the full `Transcript` with word timestamps. ONNX engines (Parakeet etc.) later.

## Acceptance criteria
- [ ] PCM input yields a `Transcription` with word timestamps.
- [ ] `translate_utterance` produces word-aligned output.
- [ ] Tutor reply returns.

## Test plan
- Unit: `transcription_adapter` conversion; coordinator flow with fakes.
- Integration: real mic PTT (manual).
