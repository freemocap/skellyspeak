# Spec: Core data model

## Purpose
The serde types shared across transcription, translation, alignment, and the tutor.
This is the **first code slice** (implemented + unit-tested).

## Types (`skellysubs-core/src/models`)
- `WordTimestamp` { start_ms, end_ms, text, index_in_segment, index_in_transcript }
- `TranscriptSegment` { start_ms, end_ms, text, words }
- `Transcription` { language, text, segments }
- `TranslatedText` { translated_text, romanized_text?, translated_language_name, romanization_method? }
- `MatchedTranslatedWord` { start_time, end_time, original_word_text, original_word_index,
  translated_word_text, translated_word_romanized_text?, translated_word_index }
- `MatchedTranslatedSegment` { start, end, original_segment_text, translated_segment_text,
  romanized_translated_text?, original_words_list, translated_words_list,
  romanized_translated_words_list?, matched_translated_words }
- `LanguageConfig` / `LanguageBackground`

## Acceptance criteria
- [ ] Timestamps are milliseconds (`i64`), matching transcribe.cpp.
- [ ] "NONE"/"" romanization deserializes to `None`.
- [ ] Matched-word types omit the redundant per-word language config (store a key instead).
- [ ] serde round-trip + `schemars` JSON-schema generation work.

## Test plan (unit)
serde round-trips; "NONE" handling; schema has required fields; 78-language JSON parses.
