//! Explicit emoji sequence grammar, mirrored in personaLimits.ts.
//! Selectors and modifiers only qualify eligible bases; neither proves that an
//! arbitrary grapheme is an emoji. Both boundaries run test-fixtures/emoji.json.

use regex::Regex;
use std::sync::OnceLock;

fn properties() -> &'static [Regex; 5] {
    static VALUE: OnceLock<[Regex; 5]> = OnceLock::new();
    VALUE.get_or_init(|| {
        [
            "Emoji_Presentation",
            "Extended_Pictographic",
            "Emoji_Modifier_Base",
            "Emoji_Modifier",
            "Regional_Indicator",
        ]
        .map(|property| {
            Regex::new(&format!(r"^\p{{{property}}}$"))
                .expect("Unicode emoji property is available")
        })
    })
}

pub fn is_emoji(value: &str) -> bool {
    let [
        presentation,
        pictographic,
        modifier_base,
        modifier,
        regional,
    ] = properties();
    let chars: Vec<char> = value.chars().collect();
    if chars.len() == 2 && chars.iter().all(|c| regional.is_match(&c.to_string())) {
        return true;
    }
    if matches!(chars.first(), Some('0'..='9' | '#' | '*'))
        && (chars.get(1..) == Some(&['\u{20E3}'][..])
            || chars.get(1..) == Some(&['\u{FE0F}', '\u{20E3}'][..]))
    {
        return true;
    }
    if chars.first() == Some(&'🏴')
        && chars.len() >= 4
        && chars.last() == Some(&'\u{E007F}')
        && chars[1..chars.len() - 1]
            .iter()
            .all(|c| ('\u{E0061}'..='\u{E007A}').contains(c))
    {
        return true;
    }
    value.split('\u{200D}').all(|component| {
        let mut chars = component.chars().peekable();
        let Some(base) = chars.next() else {
            return false;
        };
        let base = base.to_string();
        if regional.is_match(&base) || modifier.is_match(&base) {
            return false;
        }
        let selector = chars.peek() == Some(&'\u{FE0F}');
        if selector {
            chars.next();
        }
        let modified = chars
            .peek()
            .is_some_and(|c| modifier.is_match(&c.to_string()));
        if modified {
            chars.next();
        }
        chars.next().is_none()
            && (!modified || modifier_base.is_match(&base))
            && (presentation.is_match(&base)
                || (pictographic.is_match(&base) && (selector || modified)))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shared_adversarial_sequences() {
        let fixtures: Vec<(String, bool)> =
            serde_json::from_str(include_str!("../../test-fixtures/emoji.json")).unwrap();
        for (value, expected) in fixtures {
            assert_eq!(is_emoji(&value), expected, "{value:?}");
        }
    }

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
