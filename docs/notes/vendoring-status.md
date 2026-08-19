# Vendoring status (Handy → SkellySubs)

## ✅ Compiled (cargo check -p skellysubs passes)

Vendored Handy's machinery **verbatim** (MIT) into `skellysubs/src-tauri/src/`:

- `managers/` — audio (capture+VAD), transcription (STT), model (+download),
  model_capabilities, gguf_meta, history
- `audio_toolkit/`, `catalog/`, `helpers/`, `portable.rs`
- `llm_client.rs`, `settings.rs`, `utils.rs` (stripped of dictation)

**Stripped (dictation glue we replace with our own):**
- `transcription_coordinator.rs` (deleted — referenced `crate::actions`)
- `utils.rs` re-exports of clipboard/overlay/tray + cancel_current_operation
- `emit_levels` stubbed to a no-op (Handy's overlay audio meter)

**Remaining warnings (Handy's own, harmless):**
- dead assignment `model_takes_initial_prompt` in transcription.rs
- `SecretMap` visibility nit in settings.rs

## Next (our own domain — Handy has none of this)

1. Register plugins in `lib.rs` (tauri-plugin-store/log/os) for runtime.
2. Write our own push-to-talk coordinator (capture → VAD → transcribe → translate → tutor).
3. Tauri commands + events + chat UI.
