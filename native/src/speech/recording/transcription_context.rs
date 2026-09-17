//! Whisper's prompt is preceding transcript context, not a chat instruction.
//! Keep the script of the selected language instead of English region labels.
use unicode_segmentation::UnicodeSegmentation;

pub(super) fn prompt(native_name: &str, previous: Option<&str>) -> String {
    let mut prompt = native_name.to_owned();
    if let Some(previous) = previous.filter(|text| !text.trim().is_empty()) {
        prompt.push('\n');
        prompt.push_str(previous.trim());
    }
    // A conservative byte bound fits the provider's 224-token context budget
    // without splitting a grapheme. [@groq_transcription_context]
    let mut bytes = 0;
    prompt
        .graphemes(true)
        .take_while(|grapheme| {
            bytes += grapheme.len();
            bytes <= 224
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn context_uses_the_languages_own_script_and_is_bounded() {
        for (name, previous) in [
            ("മലയാളം", "സൈക്കിൾ ഉണ്ടോ?"),
            ("हिन्दी", "आप कैसे हैं?"),
            ("العربية", "كيف حالك؟"),
            ("Français", "Comment allez-vous ?"),
        ] {
            assert_eq!(prompt(name, Some(previous)), format!("{name}\n{previous}"));
            assert_eq!(prompt(name, None), name);
        }
        let bounded = prompt("മലയാളം", Some(&"ക്ക".repeat(1000)));
        assert!(bounded.len() <= 224);
        assert!(bounded.ends_with("ക്ക"));
    }
}
