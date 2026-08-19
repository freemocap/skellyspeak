//! Timestamp formatting for SRT / VTT / SSA / Markdown.

pub fn format_srt_time(ms: i64) -> String {
    let ms = ms.max(0) as u64;
    let h = ms / 3_600_000;
    let m = (ms / 60_000) % 60;
    let s = (ms / 1000) % 60;
    let milli = ms % 1000;
    format!("{h:02}:{m:02}:{s:02},{milli:03}")
}

pub fn format_vtt_time(ms: i64) -> String {
    let ms = ms.max(0) as u64;
    let h = ms / 3_600_000;
    let m = (ms / 60_000) % 60;
    let s = (ms / 1000) % 60;
    let milli = ms % 1000;
    format!("{h:02}:{m:02}:{s:02}.{milli:03}")
}

pub fn format_ssa_time(ms: i64) -> String {
    let ms = ms.max(0) as u64;
    let h = ms / 3_600_000;
    let m = (ms / 60_000) % 60;
    let s = (ms / 1000) % 60;
    let cs = (ms % 1000) / 10;
    format!("{h}:{m:02}:{s:02}.{cs:02}")
}

pub fn format_markdown_time(ms: i64) -> String {
    format_vtt_time(ms)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn srt_zero() {
        assert_eq!(format_srt_time(0), "00:00:00,000");
    }
    #[test]
    fn srt_one_second() {
        assert_eq!(format_srt_time(1000), "00:00:01,000");
    }
    #[test]
    fn srt_full() {
        assert_eq!(format_srt_time(3_661_001), "01:01:01,001");
    }
    #[test]
    fn srt_negative_clamps() {
        assert_eq!(format_srt_time(-5), "00:00:00,000");
    }
    #[test]
    fn vtt_uses_dot() {
        assert_eq!(format_vtt_time(1000), "00:00:01.000");
    }
    #[test]
    fn ssa_centiseconds() {
        assert_eq!(format_ssa_time(1000), "0:00:01.00");
    }
}
