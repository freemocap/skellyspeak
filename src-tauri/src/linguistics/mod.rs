//! Source-preserving, grapheme-safe annotation core; no provider or storage wiring.
//! See CONTRACT.md for semantic limits and future phrase layers.

pub mod adapter;

use unicode_segmentation::UnicodeSegmentation;

pub const BOUNDARY_POLICY: &str = "uax29-egc-17.0.0-us1.13.3-v1";

pub const ANALYSIS_VERSION: &str = "partner-gloss-v1";
pub const MAX_SOURCE_SCALARS: usize = 4096;
pub const MAX_SPANS: usize = 512;
pub const MAX_GLOSS_SCALARS: usize = 256;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SourceIdentity {
    pub message_id: String,
    pub target_language_id: String,
    pub explanation_language_id: String,
    pub analysis_version: String,
}

/// Half-open Unicode scalar coordinates, never byte or UTF-16 indices.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Span {
    pub start: usize,
    pub end: usize,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Unit {
    Word,
    /// Requires a separate result layer; rejected in the word-gloss candidate.
    Phrase,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Annotation {
    Gloss { unit: Unit, gloss: String },
    Literal,
    Unresolved,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CandidateSpan {
    pub span: Span,
    pub annotation: Annotation,
}

/// Identity is attached by the owning adapter, not returned by the model.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Candidate {
    pub source: SourceIdentity,
    pub spans: Vec<CandidateSpan>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Coverage {
    Complete,
    Partial,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Origin {
    Candidate,
    DeterministicGap,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Segment {
    pub span: Span,
    pub annotation: Annotation,
    pub origin: Origin,
}

/// Only validate() constructs accepted results. Source strings are never copied
/// out of provider output; callers resolve spans against the captured source.
#[derive(Debug, PartialEq, Eq)]
pub struct ValidatedAnalysis {
    source: SourceIdentity,
    segments: Vec<Segment>,
    coverage: Coverage,
}

impl ValidatedAnalysis {
    pub fn source(&self) -> &SourceIdentity {
        &self.source
    }

    pub fn segments(&self) -> &[Segment] {
        &self.segments
    }

    /// Structural completeness is not a claim of useful or correct word help.
    pub fn coverage(&self) -> Coverage {
        self.coverage
    }

    pub fn gloss_count(&self) -> usize {
        self.segments
            .iter()
            .filter(|segment| matches!(segment.annotation, Annotation::Gloss { .. }))
            .count()
    }

    pub fn gloss_scalar_count(&self) -> usize {
        self.segments
            .iter()
            .filter(|segment| matches!(segment.annotation, Annotation::Gloss { .. }))
            .map(|segment| segment.span.end - segment.span.start)
            .sum()
    }

    pub fn unresolved_scalar_count(&self) -> usize {
        self.segments
            .iter()
            .filter(|segment| segment.annotation == Annotation::Unresolved)
            .map(|segment| segment.span.end - segment.span.start)
            .sum()
    }
}

/// Fixed codes with indices only: no source text or generated gloss in errors.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ValidationError {
    InvalidIdentity,
    UnsupportedVersion,
    SourceMismatch,
    EmptySource,
    SourceTooLong,
    TooManySpans,
    EmptyOrReversedSpan,
    OutOfRange,
    UnknownBoundary,
    UnsafeGraphemeBoundary,
    PhraseRequiresSeparateLayer { index: usize },
    OverlapOrUnordered { index: usize },
    InvalidSpan { index: usize, reason: SpanError },
    BlankGloss { index: usize },
    GlossTooLong { index: usize },
    WhitespaceGloss { index: usize },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SpanError {
    EmptyOrReversed,
    OutOfRange,
    UnsafeGraphemeBoundary,
}

/// App-generated entry for coordinate-format evaluation. IDs are opaque to the
/// consumer and scoped to the captured message/contract, not global source IDs.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Boundary {
    pub id: String,
    pub scalar_offset: usize,
    pub byte_offset: usize,
    pub utf16_offset: usize,
}

/// Scalar conversion and Unicode 17 extended grapheme safety, not word tokenization.
pub struct SourceMap<'a> {
    text: &'a str,
    bytes: Vec<usize>,
    utf16: Vec<usize>,
    allowed: Vec<bool>,
}

impl<'a> SourceMap<'a> {
    pub fn new(text: &'a str) -> Result<Self, ValidationError> {
        let mut bytes = Vec::new();
        let mut utf16 = Vec::new();
        let mut units = 0;
        for (offset, ch) in text.char_indices() {
            if bytes.len() == MAX_SOURCE_SCALARS {
                return Err(ValidationError::SourceTooLong);
            }
            bytes.push(offset);
            utf16.push(units);
            units += ch.len_utf16();
        }
        bytes.push(text.len());
        utf16.push(units);
        let mut allowed = vec![false; bytes.len()];
        for (byte_offset, _) in text.grapheme_indices(true) {
            let scalar_offset = bytes
                .binary_search(&byte_offset)
                .expect("grapheme boundary must be a scalar boundary");
            allowed[scalar_offset] = true;
        }
        allowed[bytes.len() - 1] = true;
        Ok(Self {
            text,
            bytes,
            utf16,
            allowed,
        })
    }

    pub fn scalar_len(&self) -> usize {
        self.bytes.len() - 1
    }

    /// Includes only extended grapheme boundaries and the terminal boundary; no
    /// copied source text. The adapter binds the catalog to its captured source.
    pub fn boundaries(&self) -> Vec<Boundary> {
        (0..=self.scalar_len())
            .filter(|offset| self.allowed[*offset])
            .map(|offset| Boundary {
                id: format!("b{offset:04}"),
                scalar_offset: offset,
                byte_offset: self.bytes[offset],
                utf16_offset: self.utf16[offset],
            })
            .collect()
    }

    /// Resolve exact catalog IDs. This does not authorize a source, validate
    /// metadata or overlap; call validate afterwards. Endpoints must be grapheme-safe.
    pub fn resolve_boundaries(&self, start: &str, end: &str) -> Result<Span, ValidationError> {
        let resolve = |id: &str| {
            if id.len() != 5
                || !id.starts_with('b')
                || !id.as_bytes()[1..].iter().all(u8::is_ascii_digit)
            {
                return Err(ValidationError::UnknownBoundary);
            }
            let offset = id[1..]
                .parse::<usize>()
                .map_err(|_| ValidationError::UnknownBoundary)?;
            if offset > self.scalar_len() || !self.allowed[offset] {
                return Err(ValidationError::UnknownBoundary);
            }
            Ok(offset)
        };
        let span = Span {
            start: resolve(start)?,
            end: resolve(end)?,
        };
        self.check(span)?;
        Ok(span)
    }

    fn check(&self, span: Span) -> Result<(), ValidationError> {
        if span.start >= span.end {
            return Err(ValidationError::EmptyOrReversedSpan);
        }
        if span.end > self.scalar_len() {
            return Err(ValidationError::OutOfRange);
        }
        Ok(())
    }

    pub fn validate_grapheme_span(&self, span: Span) -> Result<(), ValidationError> {
        self.check(span)?;
        if !self.allowed[span.start] || !self.allowed[span.end] {
            return Err(ValidationError::UnsafeGraphemeBoundary);
        }
        Ok(())
    }

    /// Coordinate conversion only; candidate validation additionally checks graphemes.
    pub fn byte_span(&self, span: Span) -> Result<Span, ValidationError> {
        self.check(span)?;
        Ok(Span {
            start: self.bytes[span.start],
            end: self.bytes[span.end],
        })
    }

    pub fn utf16_span(&self, span: Span) -> Result<Span, ValidationError> {
        self.check(span)?;
        Ok(Span {
            start: self.utf16[span.start],
            end: self.utf16[span.end],
        })
    }

    pub fn slice(&self, span: Span) -> Result<&'a str, ValidationError> {
        let bytes = self.byte_span(span)?;
        Ok(&self.text[bytes.start..bytes.end])
    }
}

pub fn validate(
    expected: &SourceIdentity,
    text: &str,
    candidate: &Candidate,
) -> Result<ValidatedAnalysis, ValidationError> {
    if expected.message_id.trim().is_empty()
        || expected.target_language_id.trim().is_empty()
        || expected.explanation_language_id.trim().is_empty()
    {
        return Err(ValidationError::InvalidIdentity);
    }
    if expected.analysis_version != ANALYSIS_VERSION {
        return Err(ValidationError::UnsupportedVersion);
    }
    if candidate.source != *expected {
        return Err(ValidationError::SourceMismatch);
    }
    let map = SourceMap::new(text)?;
    if text.trim().is_empty() {
        return Err(ValidationError::EmptySource);
    }
    if candidate.spans.len() > MAX_SPANS {
        return Err(ValidationError::TooManySpans);
    }
    let mut segments = Vec::new();
    let mut cursor = 0;
    for (index, item) in candidate.spans.iter().enumerate() {
        map.validate_grapheme_span(item.span)
            .map_err(|error| ValidationError::InvalidSpan {
                index,
                reason: match error {
                    ValidationError::EmptyOrReversedSpan => SpanError::EmptyOrReversed,
                    ValidationError::OutOfRange => SpanError::OutOfRange,
                    ValidationError::UnsafeGraphemeBoundary => SpanError::UnsafeGraphemeBoundary,
                    _ => unreachable!("span validation returned an unrelated error"),
                },
            })?;
        let source_slice = map.slice(item.span)?;
        if item.span.start < cursor {
            return Err(ValidationError::OverlapOrUnordered { index });
        }
        if let Annotation::Gloss { unit, gloss } = &item.annotation {
            if *unit == Unit::Phrase {
                return Err(ValidationError::PhraseRequiresSeparateLayer { index });
            }
            if gloss.trim().is_empty() {
                return Err(ValidationError::BlankGloss { index });
            }
            if gloss.chars().take(MAX_GLOSS_SCALARS + 1).count() > MAX_GLOSS_SCALARS {
                return Err(ValidationError::GlossTooLong { index });
            }
            if source_slice.trim().is_empty() {
                return Err(ValidationError::WhitespaceGloss { index });
            }
        }
        append_gap(&map, &mut segments, cursor, item.span.start)?;
        segments.push(Segment {
            span: item.span,
            annotation: item.annotation.clone(),
            origin: Origin::Candidate,
        });
        cursor = item.span.end;
    }
    append_gap(&map, &mut segments, cursor, map.scalar_len())?;
    let coverage = if segments
        .iter()
        .any(|segment| segment.annotation == Annotation::Unresolved)
    {
        Coverage::Partial
    } else {
        Coverage::Complete
    };
    Ok(ValidatedAnalysis {
        source: expected.clone(),
        segments,
        coverage,
    })
}

fn append_gap(
    map: &SourceMap<'_>,
    segments: &mut Vec<Segment>,
    start: usize,
    end: usize,
) -> Result<(), ValidationError> {
    if start == end {
        return Ok(());
    }
    let span = Span { start, end };
    let annotation = if map.slice(span)?.chars().all(char::is_whitespace) {
        Annotation::Literal
    } else {
        Annotation::Unresolved
    };
    segments.push(Segment {
        span,
        annotation,
        origin: Origin::DeterministicGap,
    });
    Ok(())
}

#[cfg(test)]
mod tests;
