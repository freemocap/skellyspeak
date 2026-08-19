# Spec: Audio capture (push-to-talk)

## Purpose
Capture mic audio on PTT hold, trim silence, emit 16 kHz mono f32 PCM.

## Implementation
**VENDOR Handy's `managers/audio.rs`** (cpal capture + vad-rs/Silero VAD). We do
not write capture/VAD ourselves.

## Behavior
- PTT hold = record; release = finalize.
- VAD trims leading/trailing silence.

## Acceptance criteria
- [ ] A spoken utterance yields non-empty PCM; pure silence is dropped.
- [ ] Sample rate is 16 kHz mono.

## Test plan
Unit: VAD on synthetic silence vs tone (from Handy's own tests). Integration: manual.
