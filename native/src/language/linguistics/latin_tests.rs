use super::*;

#[test]
fn accented_latin_and_mutated_forms_preserve_source_and_utf16_offsets() {
    // Encoding fixtures, not assertions about word segmentation or pronunciation.
    for source in [
        "È perché un po’",
        "E\u{300} perche\u{301} un po'",
        "Gaeilge: ár n-athair",
        "Gaeilge: a\u{301}r n-athair",
        "Gàidhlig: a’ phàirc",
        "Ga\u{300}idhlig: an t-Òban",
    ] {
        let text = format!("🌿 {source}");
        let map = SourceMap::new(&text).unwrap();
        let span = Span {
            start: 2,
            end: text.chars().count(),
        };
        map.validate_grapheme_span(span).unwrap();
        assert_eq!(map.slice(span).unwrap(), source);
        assert_eq!(map.utf16_span(span).unwrap().start, 3);
        assert_eq!(
            map.utf16_span(span).unwrap().end,
            text.encode_utf16().count()
        );
    }
    for text in ["a\u{301}", "a\u{300}", "E\u{300}"] {
        let map = SourceMap::new(text).unwrap();
        assert!(
            map.validate_grapheme_span(Span { start: 0, end: 1 })
                .is_err()
        );
    }
}
