# ADR-0005: Vendor Handy's machinery — do not reimplement capture/transcription/models

**Status:** Accepted (supersedes the "mirror the architecture" language in ADR-0002)

**Decision:** We pull Handy's audio-capture, VAD, transcription, and model-management
code **straight from Handy** (MIT) into our app. We do NOT reimplement any of it.
We fork/vendor the relevant Handy modules, strip the dictation-specific parts, and
build SkellySubs on top.

**What we vendor from Handy (src-tauri):**
- `managers/audio.rs` (cpal capture + vad-rs/Silero VAD)
- `transcription_coordinator.rs` + `managers/transcription.rs` (drives transcribe-rs + transcribe-cpp)
- `managers/model.rs` + `managers/model/download.rs` + `managers/model_capabilities.rs` + `managers/gguf_meta.rs` (model download/capabilities) + `hf-hub`
- `llm_client.rs` (reqwest + JSON-schema LLM client)
- `audio_toolkit/` (WAV/resample helpers)

**What we write (SkellySubs-specific):** translation prompts + word-matching, tutor
layer, subtitle formatters, chat UI, 78-language config.

**Consequences:** we inherit Handy's battle-tested STT/VAD/model code and their
fixes; we only own the translation/chat domain. Attribution + our own branding (MIT).
