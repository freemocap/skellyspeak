# Spec: Word-level alignment (the SkellySubs IP)

## Purpose
Align each spoken word to its closest word in the target language (many-to-one), to
drive the live highlight.

## Behavior
- Reuse the three `python-only` prompts **verbatim** (full-text, segment, word-match).
- Per turn: translate the utterance, then word-match it.

## Acceptance criteria
- [ ] The word-match prompt returns a `MatchedTranslatedSegment` whose
  `matched_translated_words` has one entry per original word.
- [ ] Many-to-one alignment works (one target word matching several original words).
- [ ] No unfilled prompt placeholders; prompts match the original text byte-for-byte.

## Test plan
Unit: prompt template equality + placeholder filling; alignment validation on fixtures.
