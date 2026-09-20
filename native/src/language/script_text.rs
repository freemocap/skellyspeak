//! Script-dependent text validation belongs to language handling, not coaching.
//! Script identifiers come from the resolved language configuration.

pub(crate) fn requires_romanization(script: &str) -> bool {
    script != "latin"
}

/// Preserve the existing mixed-name tolerance and Latin-target validation policy.
pub(crate) fn matches_reply_script(value: &str, script: &str) -> bool {
    !requires_romanization(script) || mostly_script(value, script)
}

pub(crate) fn is_romanization_letter(c: char) -> bool {
    c.is_ascii_alphabetic()
        || matches!(c, '\u{00AA}' | '\u{00BA}' | '\u{00C0}'..='\u{02FF}' | '\u{1E00}'..='\u{1EFF}' | '\u{2C60}'..='\u{2C7F}' | '\u{A720}'..='\u{A7FF}')
}
/// Whether a letter belongs to a configured script id; unknown non-Latin
/// scripts accept any non-Latin letter.
fn in_script(script: &str, c: char) -> bool {
    match script {
        "latin" => is_romanization_letter(c),
        "arabic" => {
            matches!(c, '\u{0600}'..='\u{06FF}' | '\u{0750}'..='\u{077F}' | '\u{0870}'..='\u{08FF}' | '\u{FB50}'..='\u{FDFF}' | '\u{FE70}'..='\u{FEFF}')
        }
        "devanagari" => matches!(c, '\u{0900}'..='\u{097F}' | '\u{A8E0}'..='\u{A8FF}'),
        "malayalam" => matches!(c, '\u{0D00}'..='\u{0D7F}'),
        "simplified-chinese" => {
            matches!(c, '\u{3400}'..='\u{4DBF}' | '\u{4E00}'..='\u{9FFF}' | '\u{F900}'..='\u{FAFF}' | '\u{20000}'..='\u{3134F}')
        }
        _ => !is_romanization_letter(c),
    }
}
/// Most letters are in the target script; tolerates embedded names or brands.
fn mostly_script(value: &str, script: &str) -> bool {
    let (mut hits, mut letters) = (0, 0);
    for c in value.chars().filter(|c| c.is_alphabetic()) {
        letters += 1;
        hits += usize::from(in_script(script, c));
    }
    hits * 2 > letters
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shared_scripts_are_not_tied_to_language_identity() {
        // Arabic, Urdu and Persian all use the same configured script capability.
        for text in ["البيوت", "گھر", "خانه"] {
            assert!(matches_reply_script(text, "arabic"));
            assert!(!matches_reply_script(text, "devanagari"));
        }
        // Hindi and Marathi share Devanagari handling.
        for text in ["नमस्ते", "मराठी"] {
            assert!(matches_reply_script(text, "devanagari"));
        }
        assert!(matches_reply_script("നമസ്കാരം", "malayalam"));
        assert!(matches_reply_script("你好", "simplified-chinese"));
        assert!(!matches_reply_script("Hello", "arabic"));
    }

    #[test]
    fn romanization_validation_preserves_script_policy() {
        assert!(!requires_romanization("latin"));
        assert!(requires_romanization("arabic"));
        for character in "buyūt".chars() {
            assert!(is_romanization_letter(character));
        }
        assert!(!is_romanization_letter('ب'));
        // Moving ownership must not change the existing Latin-target policy.
        assert!(matches_reply_script("embedded names", "latin"));
    }
}
