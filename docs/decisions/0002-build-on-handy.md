# ADR-0002: Build on Handy, don't fork or cherry-pick

**Status:** Accepted

**Decision:** Scaffold a fresh Tauri v2 app on Handy's stack; depend on its published
crates; mirror its architecture; write our own domain. Do NOT fork the whole app
(dictation-specific) or copy files piecemeal.

**Rationale:** Handy is MIT and explicitly "the most forkable STT app". Its crates
(`transcribe-rs` ONNX, `transcribe-cpp` GGML, `vad-rs`, `hf-hub`)
and patterns (specta bridge, model manager, reqwest JSON-schema LLM) are exactly what we need.

**Consequences:** We inherit Handy's fixes via crates.io; our app remains our own.
**Constraint:** Handy's name/logo/brand are NOT open-source [[R]] we use our own branding.
