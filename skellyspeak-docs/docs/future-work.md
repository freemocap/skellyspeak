---
sidebar_position: 7
title: Future Work
---

# Future Work — the mechanical analysis layer & language ladder

Status: **specified, not started.** The current implementation does every
analysis task (tokenization, glossing, POS tagging, translation) with LLM
calls, because that was the fastest path to a working loop. This page specs
the end-state: **AI is constrained to the work that actually needs it.**

## Principle

AI is for **generation and judgment** — conversation, teaching explanations,
pedagogical planning, story writing. Everything that is *reference data or
deterministic text processing* must not cross the LLM boundary: tokenization,
lemma lookup, dictionary glosses, POS tags, frequency ranking. Those are
solved problems with free, embeddable, licensed data. Using an LLM for them
buys latency (10–160s turns observed), cost, stochastic inconsistency (the
same word glossed three different ways across turns — bad pedagogy), and an
entire failure class (repetition loops, schema drift) that simply stops
existing when the call stops existing.

AI's remaining per-turn role after migration: the **reply** (1 call) and the
**observer** (1 call), plus occasional small residue-glossing calls. AI may
also spot-check dictionary output offline in batch — never per keystroke.

## Target architecture (the analysis layer)

```
reply text ──► tokenize ──► lemmatize ──► dictionary lookup ──► frequency rank ──► analysis pane
                                │                 │                            (instant, offline)
                                ▼                 ▼
                     unknown/irregular      multiword + OOV residue
                     morphology flags       ──► ONE small AI gloss call (only when residue exists)
```

- **Tokenize:** Unicode segmentation; trivial for space-delimited languages.
- **Lemmatize:** inflection→lemma map or finite-state morphology
  (Apertium analyzers; wiktextract form tables).
- **Gloss:** wordform/lemma → top senses, from **wiktextract** Wiktionary
  dumps (CC BY-SA — attribution required in-app), **FreeDict**, or
  **Open Multilingual WordNet**. Phrase dictionary for multiword
  expressions (longest-match first).
- **Frequency rank:** open top-50k lists; "new word" flag = not in top N.
- **Residue → AI:** idioms and OOV tokens get one batched call per turn,
  *only when leftovers exist*. Many turns will need zero.
- **Grammar cards:** stay AI for the long tail; a curated static card pack
  keyed by detected morphology (top ~50 constructions) is a later refinement.

## Language ladder

Support is added rung by rung; each rung proves techniques the next one
reuses. `TARGET_LANGUAGES` is trimmed to the current rung — a language may
only appear in the UI once its mechanical layer exists.

1. **Spanish (es-ES)** — easiest case: space-delimited, richest open data.
2. **Arabic** — adds RTL rendering and root-based morphology (no vowelization
   in text); hardest display + lemmatization twist.
3. **Mandarin Chinese** — segmentation becomes the whole problem
   (jieba-style; CC-CEDICT for lookup). No inflection, tones in glosses.
4. **Everything else** (fr, it, pt, de, en, ja) — interpolation of the three
   techniques above; Japanese reuses the Mandarin segmentation work
   (lindera/JMdict).

## Per-language text dialects (ladder notes)

Several "pure code" text helpers are currently **Spanish/European-centric**
and must be extended per rung, not assumed universal:

- Sentence splitting + reply sanitization markers use
  `[.!?…]` / es+en leaked-note markers (`sentences.ts`, `sanitize_reply`).
- Token join spacing (`token-spacing.ts`) is space-delimited-logic; Arabic
  adds RTL (use logical CSS properties + `dir` attributes), Chinese/Japanese
  need **no spaces between tokens** and CJK-aware segmentation.
- Keyboard/voice input hints (`lang`, STT language codes) come from the
  language table already — keep that as the single source.

## Migration bites

1. Bundle `wordform → {lemma, POS, glosses, freq}` for es-ES; replace the
   TokensOut call with local lookup; mark OOV tokens.
2. Residue glossing call (only when leftovers exist).
3. Offline spot-check pipeline for dictionary quality (batch, not per-turn).
4. Arabic rung; then Mandarin rung; then interpolation.

## Success metrics

- Analysis pane renders with **zero network calls** for ~90%+ of tokens.
- Per-turn AI calls: 2 (reply + observer), residue call only when needed.
- Gloss consistency: identical token → identical gloss across sessions.
- OOV rate on normal conversation < 5%.
