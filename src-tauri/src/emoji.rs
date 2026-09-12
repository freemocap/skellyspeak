//! Emoji recognition for authored Vibe.
//!
//! A learner may paste any emoji, so this is recognition rather than an
//! allowlist. The rule is one grapheme cluster carrying either a character whose
//! default presentation is emoji, a presentation selector that makes an
//! otherwise text-default character emoji, or a flag's regional indicator pair.
//! Recognising default presentation is what rejects bare "↔", "▪", "⬀" and "☀"
//! while accepting "↔️", "▪️", "☀️".

use regex::Regex;
use std::sync::OnceLock;
use unicode_segmentation::UnicodeSegmentation;

fn presentation() -> &'static Regex {
    static VALUE: OnceLock<Regex> = OnceLock::new();
    VALUE.get_or_init(|| {
        Regex::new(r"\p{Emoji_Presentation}").expect("the Unicode emoji property is available")
    })
}

/// Variation selector-16 and the keycap mark complete a sequence rather than
/// standing alone, so either proves emoji intent.
const SELECTORS: [char; 2] = ['\u{FE0F}', '\u{20E3}'];
const REGIONAL_FIRST: u32 = 0x1F1E6;
const REGIONAL_LAST: u32 = 0x1F1FF;

pub fn is_emoji(value: &str) -> bool {
    let mut clusters = value.graphemes(true);
    let Some(cluster) = clusters.next() else {
        return false;
    };
    if clusters.next().is_some() {
        return false;
    }
    let mut regional = 0;
    for character in cluster.chars() {
        if SELECTORS.contains(&character) {
            return true;
        }
        let code = character as u32;
        if (REGIONAL_FIRST..=REGIONAL_LAST).contains(&code) {
            regional += 1;
            continue;
        }
        if presentation().is_match(&character.to_string()) {
            return true;
        }
    }
    // A flag is exactly two regional indicators; one alone is a letter box.
    regional == 2
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_emoji_presentation_selectors_and_flags() {
        for value in [
            "🌿",
            "🌊",
            "📚",
            "🎵",
            "🚲",
            "🍵",
            "🌙",
            "🎨",
            "🍊",
            "🚜",
            "🇪🇸",
            "🇯🇵",
            "1️⃣",
            "👩‍🍳",
            "☀️",
            "🏔️",
            "🏛️",
            "🛠️",
            "↔️",
            "▪️",
            "⭐",
        ] {
            assert!(is_emoji(value), "{value} should be an emoji");
        }
    }

    #[test]
    fn rejects_text_symbols_without_emoji_presentation() {
        for value in ["↔", "▪", "⬀", "☀", "©", "®"] {
            assert!(!is_emoji(value), "{value} should not be an emoji");
        }
    }

    #[test]
    fn rejects_text_multiple_clusters_and_dangling_regional_indicators() {
        for value in [
            "", "a", "A", "x1", "hola", "1", "#", "  ", "🌿🌿", "🌿 a", "🇪",
        ] {
            assert!(!is_emoji(value), "{value} should not be an emoji");
        }
    }
}
