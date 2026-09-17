use super::*;

#[test]
fn indic_graphemes_reject_internal_cuts_and_preserve_exact_source() {
    // Conjuncts, reordered vowel signs, nukta, atomic and legacy chillu.
    // These are encoding fixtures, not a claim of word-level linguistic analysis.
    // [@unicode17_indic]
    for text in ["कि", "क्ष", "क़", "ക്ക", "കൊ", "ൻ", "ന്\u{200d}"] {
        let map = SourceMap::new(text).unwrap();
        let span = Span {
            start: 0,
            end: text.chars().count(),
        };
        map.validate_grapheme_span(span).unwrap();
        assert_eq!(map.slice(span).unwrap(), text);
        for end in 1..span.end {
            assert!(
                map.validate_grapheme_span(Span { start: 0, end }).is_err(),
                "{text}: {end}"
            );
        }
        assert_eq!(
            map.utf16_span(span).unwrap().end,
            text.encode_utf16().count()
        );
    }
}
