//! Retrieval hints only; matching never rewrites source text or awards evidence.
use unicode_normalization::UnicodeNormalization;
use unicode_segmentation::UnicodeSegmentation;

fn words(text: &str, turkish: bool) -> Vec<String> {
    let normalized: String = text
        .nfc()
        // [@unicode_turkish_case] Turkish has two distinct I/i pairs.
        .map(|c| {
            if turkish {
                match c {
                    'I' => 'ı',
                    'İ' => 'i',
                    _ => c,
                }
            } else {
                c
            }
        })
        .flat_map(char::to_lowercase)
        .map(|c| if c == '’' { '\'' } else { c })
        .collect();
    normalized.unicode_words().map(str::to_owned).collect()
}

pub(super) struct LexicalHints(Vec<String>, bool);
impl LexicalHints {
    pub(super) fn new(fragments: &[String], language_tag: Option<&str>) -> Self {
        let turkish = language_tag.is_some_and(|tag| tag.split('-').next() == Some("tr"));
        Self(words(&fragments.join(" "), turkish), turkish)
    }
    pub(super) fn contains(&self, phrase: &str) -> bool {
        let phrase = words(phrase, self.1);
        !phrase.is_empty() && self.0.windows(phrase.len()).any(|span| span == phrase)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn phrases_match_contiguous_words_with_unicode_case_accents_and_punctuation() {
        let text = "Ó, GO RAIBH MAITH AGAT! Tapadh leibh. MERCI, grazie.";
        let hints = LexicalHints::new(
            &text
                .split_whitespace()
                .map(str::to_owned)
                .collect::<Vec<_>>(),
            None,
        );
        for phrase in [
            "go raibh maith agat",
            "tapadh leibh",
            "merci",
            "grazie",
            "o\u{301}",
        ] {
            assert!(hints.contains(phrase), "{phrase}");
        }
        for phrase in ["maith", "tapadh"] {
            assert!(hints.contains(phrase));
        }
        for phrase in ["go maith agat", "tapadh leat", "grat", "", "!!!"] {
            assert!(!hints.contains(phrase), "{phrase}");
        }
        assert!(LexicalHints::new(&["D’FHÁG".into()], None).contains("d'fhág"));
    }
}
