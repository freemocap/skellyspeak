//! Subtitle formatters (SRT / VTT / Markdown; ASS later).

pub mod md;
pub mod srt;
pub mod time;
pub mod types;
pub mod vtt;

pub use time::{format_markdown_time, format_srt_time, format_ssa_time, format_vtt_time};
pub use types::{SubtitleFormat, SubtitleSegment, SubtitleVariant};
