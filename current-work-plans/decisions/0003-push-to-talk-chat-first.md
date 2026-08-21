# ADR-0003: Push-to-talk, chat-first MVP

**Status:** Accepted

**Decision:** MVP is a chat-first cross-language conversation partner using
**push-to-talk** (hold key, speak, release). Video subtitling is a later mode.

**Rationale:** Push-to-talk is simpler and more predictable than always-on VAD for v1;
the core value is the word-aligned bilingual transcript + tutor reply, not video.

**Consequences:** No TTS, no always-on mic, no video UI in MVP. Keep the subtitle
formatters + ffmpeg path for the later video mode.
