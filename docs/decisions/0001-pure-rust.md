# ADR-0001: Pure Rust (no Python sidecar)

**Status:** Accepted

**Decision:** Implement SkellySubs v2 entirely in Rust. Drop the Python/FastAPI/
moviepy/opencv stack from the legacy code.

**Rationale:** The old Python core is half-broken; the rebuild is from scratch anyway.
Rust + Tauri v2 gives one language, small binaries, and a path to mobile.

**Consequences:** Reimplement transcription/translation/subtitles in Rust; reuse
published Rust crates (Handy's stack) instead of Python libs.
