use super::*;

fn identity() -> SourceIdentity {
    SourceIdentity {
        message_id: "synthetic-message".into(),
        target_language_id: "es".into(),
        explanation_language_id: "en".into(),
        analysis_version: ANALYSIS_VERSION.into(),
    }
}

fn item(start: usize, end: usize, annotation: Annotation) -> CandidateSpan {
    CandidateSpan {
        span: Span { start, end },
        annotation,
    }
}

fn gloss(start: usize, end: usize, text: &str) -> CandidateSpan {
    item(
        start,
        end,
        Annotation::Gloss {
            romanization: None,
            pronunciation: None,
            unit: Unit::Word,
            gloss: text.into(),
        },
    )
}

fn check(text: &str, spans: Vec<CandidateSpan>) -> Result<ValidatedAnalysis, ValidationError> {
    validate(
        &identity(),
        text,
        &Candidate {
            source: identity(),
            spans,
        },
    )
}

fn reconstruct(text: &str, result: &ValidatedAnalysis) -> String {
    let map = SourceMap::new(text).unwrap();
    let mut cursor = 0;
    let mut rebuilt = String::new();
    for segment in result.segments() {
        assert_eq!(segment.span.start, cursor);
        rebuilt.push_str(map.slice(segment.span).unwrap());
        cursor = segment.span.end;
    }
    assert_eq!(cursor, map.scalar_len());
    rebuilt
}

#[test]
fn worked_example_preserves_repeated_words_punctuation_and_mixed_scripts() {
    let text = "Sí, sí! 你好 👋";
    let result = check(
        text,
        vec![
            gloss(0, 2, "yes"),
            item(2, 3, Annotation::Literal),
            gloss(4, 6, "yes"),
            item(6, 7, Annotation::Literal),
            gloss(8, 10, "hello"),
            item(11, 12, Annotation::Literal),
        ],
    )
    .unwrap();
    assert_eq!(result.coverage(), Coverage::Complete);
    assert_eq!(result.segments().len(), 9);
    assert_eq!(result.source(), &identity());
    assert_eq!(reconstruct(text, &result), text);
    let map = SourceMap::new(text).unwrap();
    assert_eq!(map.scalar_len(), 12);
    assert_eq!(
        map.byte_span(Span { start: 11, end: 12 }).unwrap(),
        Span { start: 17, end: 21 }
    );
    assert_eq!(
        map.utf16_span(Span { start: 11, end: 12 }).unwrap(),
        Span { start: 11, end: 13 }
    );
}

#[test]
fn all_unicode_subspans_round_trip_through_byte_and_utf16_coordinates() {
    for text in [
        "café cafe\u{301}",
        "👩🏽‍💻 🇫🇷 ✈️",
        "你好ภาษาไทย العربية",
        "a\r\n\t\u{a0}b",
    ] {
        let map = SourceMap::new(text).unwrap();
        let scalars: Vec<char> = text.chars().collect();
        let utf16: Vec<u16> = text.encode_utf16().collect();
        for start in 0..scalars.len() {
            for end in start + 1..=scalars.len() {
                let span = Span { start, end };
                let expected: String = scalars[start..end].iter().collect();
                assert_eq!(map.slice(span).unwrap(), expected);
                let units = map.utf16_span(span).unwrap();
                assert_eq!(
                    String::from_utf16(&utf16[units.start..units.end]).unwrap(),
                    expected
                );
            }
        }
    }
}

#[test]
fn combining_and_emoji_sequences_are_preserved_without_normalization() {
    let text = "e\u{301} 👩🏽‍💻";
    let result = check(
        text,
        vec![gloss(0, 2, "letter"), item(3, 7, Annotation::Literal)],
    )
    .unwrap();
    assert_eq!(reconstruct(text, &result), text);
    assert_eq!(result.coverage(), Coverage::Complete);
}

#[test]
fn annotation_endpoints_cannot_split_graphemes() {
    for cluster in ["e\u{301}", "👩🏽‍💻", "🇫🇷", "✈️", "1️⃣", "क्ष", "각", "\r\n"]
    {
        let text = format!("{cluster}x");
        let map = SourceMap::new(&text).unwrap();
        let length = cluster.chars().count();
        for internal in 1..length {
            for span in [
                Span {
                    start: 0,
                    end: internal,
                },
                Span {
                    start: internal,
                    end: length,
                },
            ] {
                for annotation in [
                    Annotation::Literal,
                    Annotation::Unresolved,
                    Annotation::Gloss {
                        romanization: None,
                        pronunciation: None,
                        unit: Unit::Word,
                        gloss: "test".into(),
                    },
                ] {
                    assert_eq!(
                        check(&text, vec![CandidateSpan { span, annotation }]),
                        Err(ValidationError::InvalidSpan {
                            index: 0,
                            reason: SpanError::UnsafeGraphemeBoundary
                        })
                    );
                }
            }
            assert_eq!(
                map.resolve_boundaries("b0000", &format!("b{internal:04}")),
                Err(ValidationError::UnknownBoundary)
            );
            assert_eq!(
                map.resolve_boundaries(&format!("b{internal:04}"), &format!("b{length:04}")),
                Err(ValidationError::UnknownBoundary)
            );
        }
        let result = check(&text, vec![item(0, length, Annotation::Literal)]).unwrap();
        assert_eq!(reconstruct(&text, &result), text);
    }
}

#[test]
fn missing_and_explicit_unresolved_coverage_is_partial() {
    for spans in [
        vec![],
        vec![gloss(0, 2, "yes")],
        vec![item(0, 6, Annotation::Unresolved)],
    ] {
        let result = check("sí, sí", spans).unwrap();
        assert_eq!(result.coverage(), Coverage::Partial);
        assert_eq!(reconstruct("sí, sí", &result), "sí, sí");
    }
}

#[test]
fn omitted_punctuation_is_not_silently_successful() {
    let result = check("sí!", vec![gloss(0, 2, "yes")]).unwrap();
    assert_eq!(result.coverage(), Coverage::Partial);
    assert_eq!(result.segments()[1].annotation, Annotation::Unresolved);
}

#[test]
fn whitespace_gaps_are_literal_and_exact() {
    let text = "\r\n sí\t\u{a0}";
    let result = check(text, vec![gloss(3, 5, "yes")]).unwrap();
    assert_eq!(result.coverage(), Coverage::Complete);
    assert_eq!(reconstruct(text, &result), text);
    assert_eq!(result.segments()[0].origin, Origin::DeterministicGap);
}

#[test]
fn phrases_cannot_replace_word_targets_and_unspaced_words_are_supported() {
    let phrase = item(
        0,
        7,
        Annotation::Gloss {
            romanization: None,
            pronunciation: None,
            unit: Unit::Phrase,
            gloss: "please".into(),
        },
    );
    assert_eq!(
        check("por fin", vec![phrase]),
        Err(ValidationError::PhraseRequiresSeparateLayer { index: 0 })
    );
    assert_eq!(
        check("你好世界", vec![gloss(0, 2, "hello"), gloss(2, 4, "world")])
            .unwrap()
            .coverage(),
        Coverage::Complete
    );
}

#[test]
fn overlaps_duplicates_nested_and_unsorted_spans_fail_atomically() {
    for spans in [
        vec![gloss(0, 3, "x"), gloss(2, 4, "y")],
        vec![gloss(0, 4, "x"), gloss(1, 2, "y")],
        vec![gloss(0, 2, "x"), gloss(0, 2, "x")],
        vec![gloss(2, 4, "x"), gloss(0, 2, "y")],
    ] {
        assert_eq!(
            check("abcd", spans),
            Err(ValidationError::OverlapOrUnordered { index: 1 })
        );
    }
}

#[test]
fn invalid_ranges_fail_without_panics_or_clamping() {
    for (start, end, reason) in [
        (1, 1, SpanError::EmptyOrReversed),
        (2, 1, SpanError::EmptyOrReversed),
        (0, 5, SpanError::OutOfRange),
        (0, usize::MAX, SpanError::OutOfRange),
        (usize::MAX - 1, usize::MAX, SpanError::OutOfRange),
    ] {
        assert_eq!(
            check("text", vec![gloss(start, end, "x")]),
            Err(ValidationError::InvalidSpan { index: 0, reason })
        );
    }
}

#[test]
fn every_identity_field_is_checked_and_retry_is_deterministic() {
    let expected = identity();
    let candidate = Candidate {
        source: expected.clone(),
        spans: vec![gloss(0, 2, "yes")],
    };
    let first = validate(&expected, "sí", &candidate).unwrap();
    assert_eq!(validate(&expected, "sí", &candidate).unwrap(), first);
    for field in 0..4 {
        let mut stale = candidate.clone();
        match field {
            0 => stale.source.message_id.push('x'),
            1 => stale.source.target_language_id.push('x'),
            2 => stale.source.explanation_language_id.push('x'),
            _ => stale.source.analysis_version.push('x'),
        }
        assert_eq!(
            validate(&expected, "sí", &stale),
            Err(ValidationError::SourceMismatch)
        );
    }
}

#[test]
fn invalid_expected_identity_and_version_fail() {
    for field in 0..3 {
        let mut source = identity();
        match field {
            0 => source.message_id = " ".into(),
            1 => source.target_language_id.clear(),
            _ => source.explanation_language_id.clear(),
        }
        assert_eq!(
            validate(
                &source,
                "x",
                &Candidate {
                    source: source.clone(),
                    spans: vec![]
                }
            ),
            Err(ValidationError::InvalidIdentity)
        );
    }
    let mut source = identity();
    source.analysis_version = "future".into();
    assert_eq!(
        validate(
            &source,
            "x",
            &Candidate {
                source: source.clone(),
                spans: vec![]
            }
        ),
        Err(ValidationError::UnsupportedVersion)
    );
}

#[test]
fn source_and_span_limits_have_exact_edges() {
    for text in ["", " \r\n\u{a0}"] {
        assert_eq!(check(text, vec![]), Err(ValidationError::EmptySource));
    }
    let text = "界".repeat(MAX_SOURCE_SCALARS);
    assert!(check(&text, vec![]).is_ok());
    assert_eq!(
        check(&(text + "界"), vec![]),
        Err(ValidationError::SourceTooLong)
    );
    let spans: Vec<_> = (0..MAX_SPANS).map(|i| gloss(i, i + 1, "x")).collect();
    assert!(check(&"字".repeat(MAX_SPANS), spans.clone()).is_ok());
    let mut too_many = spans;
    too_many.push(gloss(MAX_SPANS, MAX_SPANS + 1, "x"));
    assert_eq!(
        check(&"字".repeat(MAX_SPANS + 1), too_many),
        Err(ValidationError::TooManySpans)
    );
}

#[test]
fn gloss_limits_and_whitespace_fail_explicitly() {
    assert_eq!(
        check("x", vec![gloss(0, 1, " \n")]),
        Err(ValidationError::BlankGloss { index: 0 })
    );
    assert_eq!(
        check(" x", vec![gloss(0, 1, "space")]),
        Err(ValidationError::WhitespaceGloss { index: 0 })
    );
    assert!(check("x", vec![gloss(0, 1, &"界".repeat(MAX_GLOSS_SCALARS))]).is_ok());
    assert_eq!(
        check("x", vec![gloss(0, 1, &"界".repeat(MAX_GLOSS_SCALARS + 1))]),
        Err(ValidationError::GlossTooLong { index: 0 })
    );
}

#[test]
fn literal_only_complete_does_not_mean_word_help_is_available() {
    let result = check("hello!", vec![item(0, 6, Annotation::Literal)]).unwrap();
    assert_eq!(result.coverage(), Coverage::Complete);
    assert_eq!(result.gloss_count(), 0);
    assert_eq!(result.gloss_scalar_count(), 0);
    assert_eq!(result.unresolved_scalar_count(), 0);
    let partial = check("sí, no", vec![gloss(0, 2, "yes")]).unwrap();
    assert_eq!(partial.coverage(), Coverage::Partial);
    assert_eq!(partial.gloss_count(), 1);
    assert_eq!(partial.gloss_scalar_count(), 2);
    assert_eq!(partial.unresolved_scalar_count(), 4);
}

#[test]
fn boundary_catalog_includes_terminal_and_preserves_unspaced_positions() {
    let map = SourceMap::new("你好👋").unwrap();
    let catalog = map.boundaries();
    assert_eq!(catalog.len(), 4);
    assert_eq!(
        catalog[3],
        Boundary {
            id: "b0003".into(),
            scalar_offset: 3,
            byte_offset: 10,
            utf16_offset: 4
        }
    );
    assert_eq!(map.boundaries(), catalog);
    assert_eq!(
        map.slice(map.resolve_boundaries("b0000", "b0002").unwrap())
            .unwrap(),
        "你好"
    );
    assert_eq!(
        map.slice(map.resolve_boundaries("b0002", "b0003").unwrap())
            .unwrap(),
        "👋"
    );
}

#[test]
fn boundary_lookup_rejects_unknown_noncanonical_and_reversed_ids() {
    let map = SourceMap::new("a").unwrap();
    for id in [
        "", "b1", "b00001", "b0002", "B0001", "b+001", "b-001", "b 001", "b００", " b001",
    ] {
        assert_eq!(
            map.resolve_boundaries(id, "b0001"),
            Err(ValidationError::UnknownBoundary)
        );
        assert_eq!(
            map.resolve_boundaries("b0000", id),
            Err(ValidationError::UnknownBoundary)
        );
    }
    assert_eq!(
        map.resolve_boundaries("b0001", "b0000"),
        Err(ValidationError::EmptyOrReversedSpan)
    );
    assert_eq!(
        map.resolve_boundaries("b0001", "b0001"),
        Err(ValidationError::EmptyOrReversedSpan)
    );
}

#[test]
fn boundary_catalog_handles_empty_source_and_maximum_terminal() {
    let empty = SourceMap::new("").unwrap();
    assert_eq!(empty.boundaries().len(), 1);
    assert_eq!(
        empty.resolve_boundaries("b0000", "b0000"),
        Err(ValidationError::EmptyOrReversedSpan)
    );
    let text = "x".repeat(MAX_SOURCE_SCALARS);
    let map = SourceMap::new(&text).unwrap();
    assert_eq!(
        map.resolve_boundaries("b0000", "b4096").unwrap(),
        Span {
            start: 0,
            end: MAX_SOURCE_SCALARS
        }
    );
}

#[test]
fn boundary_and_numeric_candidates_produce_identical_results() {
    let text = "sí sí";
    let map = SourceMap::new(text).unwrap();
    let from_ids = [("b0000", "b0002"), ("b0003", "b0005")]
        .iter()
        .map(|(start, end)| CandidateSpan {
            span: map.resolve_boundaries(start, end).unwrap(),
            annotation: Annotation::Gloss {
                romanization: None,
                pronunciation: None,
                unit: Unit::Word,
                gloss: "yes".into(),
            },
        })
        .collect();
    assert_eq!(
        check(text, from_ids).unwrap(),
        check(text, vec![gloss(0, 2, "yes"), gloss(3, 5, "yes")]).unwrap()
    );
}

#[test]
fn unicode_17_grapheme_conformance() {
    assert_eq!(unicode_segmentation::UNICODE_VERSION, (17, 0, 0));
    assert_eq!(BOUNDARY_POLICY, "uax29-egc-17.0.0-us1.13.3-v1");
    let mut cases = 0;
    for (line_number, line) in include_str!("fixtures/GraphemeBreakTest-17.0.0.txt")
        .lines()
        .enumerate()
    {
        let data = line.split('#').next().unwrap().trim();
        if data.is_empty() {
            continue;
        }
        let mut text = String::new();
        let mut expected = Vec::new();
        let mut scalar = 0;
        for token in data.split_whitespace() {
            match token {
                "÷" => expected.push(scalar),
                "×" => (),
                code => {
                    text.push(char::from_u32(u32::from_str_radix(code, 16).unwrap()).unwrap());
                    scalar += 1;
                }
            }
        }
        let map = SourceMap::new(&text).unwrap();
        let actual: Vec<_> = map.boundaries().iter().map(|b| b.scalar_offset).collect();
        assert_eq!(actual, expected, "Unicode corpus line {}", line_number + 1);
        for end in 1..=scalar {
            assert_eq!(
                map.validate_grapheme_span(Span { start: 0, end }).is_ok(),
                expected.contains(&end),
                "line {} endpoint {}",
                line_number + 1,
                end
            );
        }
        let utf16: Vec<_> = text.encode_utf16().collect();
        for pair in expected.windows(2) {
            let span = Span {
                start: pair[0],
                end: pair[1],
            };
            let units = map.utf16_span(span).unwrap();
            assert_eq!(
                String::from_utf16(&utf16[units.start..units.end]).unwrap(),
                map.slice(span).unwrap()
            );
        }
        cases += 1;
    }
    assert_eq!(cases, 766, "pinned corpus case count changed");
}

#[test]
fn grapheme_catalog_retains_scalar_ids_without_normalization() {
    let map = SourceMap::new("e\u{301}x").unwrap();
    assert_eq!(
        map.boundaries()
            .iter()
            .map(|b| b.id.as_str())
            .collect::<Vec<_>>(),
        vec!["b0000", "b0002", "b0003"]
    );
    let span = map.resolve_boundaries("b0000", "b0002").unwrap();
    assert_eq!(map.slice(span).unwrap(), "e\u{301}");
}
