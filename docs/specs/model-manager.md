# Spec: Model manager (first-run download, swappable)

## Purpose
Download/verify/cache/select transcription models from HuggingFace.

## Implementation
**VENDOR Handy's `managers/model.rs` + `model/download.rs` +
`model_capabilities.rs` + `gguf_meta.rs`** + `hf-hub`. We do not build a model
manager ourselves.

## Acceptance criteria
- [ ] First run downloads the default model; subsequent runs use the cache.
- [ ] Models swappable in settings.

## Test plan
Unit: cache/verify/select logic (Handy's tests). Integration: real download (manual).
