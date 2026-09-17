# Language system audit: Hindi and Malayalam

Status: source implementation and automated verification complete on 2026-09-17. This is an
audit of language ownership, loading, resolution, retrieval, starters and reading
boundaries, not certification of linguistic content or live provider support.

## Findings and implemented changes

1. Every existing language copied the same English/Spanish/French/Arabic/Chinese
   `courtesy` tokens. The previous content refactor deliberately preserved them
   for later review. French contained Arabic thanks, not Arabic greetings. Replaced
   each list with local thanks forms, including missing German and Portuguese.
   These are small retrieval hints, not a complete list of politeness expressions.
2. Added `hindi` / `hindi-india` and `malayalam` / `malayalam-kerala`, with native
   names, shared Devanagari/Malayalam script facts, Dravidian family metadata,
   local orthographies, ALA-LC schemes, six starter topics and default partners.
   Both are learning and explanation languages; interface locale remains separate.
   New content remains `needs_review`. Hindi's weekend sample uses a masculine
   speaker form; it is an example, not a restriction on the learner's identity.
3. Reading annotation display protected only Arabic shaping. Extended whole-word
   display grouping to Devanagari and Malayalam, including suggested reply tokens.
   Semantic anchors remain unchanged. Original source text remains a single text
   node inside each grouped word; vowel signs, conjuncts and joining controls are
   not separated by annotation boxes. Native segmentation already uses Unicode 17
   extended graphemes. Added fixtures for conjuncts, nukta, reordered vowels,
   atomic and legacy chillu, plus UTF-16 offsets after emoji. [@unicode17_indic]
4. Hindi ALA-LC transliteration deliberately retains orthographic inherent vowels;
   it does not promise spoken schwa deletion. Malayalam's scheme distinguishes
   chillu and candrakkala uses. Pronunciation remains a separate field rather than
   pretending spelling transliteration is phonetics. [@ala_lc_hindi]
   [@ala_lc_malayalam]
5. New files are automatically bundled; no language enum, database migration or
   interface translation was necessary. Added bundled/disk parity and every-variety
   target/explanation checks. Froze the old refactor snapshot to its original cases
   instead of expanding a large Cartesian-product JSON artifact for new languages.
6. Corrected the authoring guide's nonexistent `learning.goals` field; the model
   has `learning.goal_material` and a shared goal catalog.

## Remaining problems, ordered by impact

- **Optional candidate retrieval is currently starved.** The catalog has 41 function
  and 3 interaction goals. `Registry::candidates` includes all 44 unconditionally,
  then stops optional selection at a total of 25. Courtesy is the only pragmatics
  goal and never enters via a token hint under the shipped catalog. Explicit focus
  still includes it. Thus the copied tokens were misleading/dead content in the
  current configuration, not evidence that French coaching actually matched Arabic.
  The regression test isolates optional retrieval with a one-goal fixture to check
  language ownership; it does not claim the production budget is repaired.
  Candidate policy needs a focused coaching decision: redefine mandatory membership
  or give optional matches a separate bounded allowance. This audit preserves the
  existing contract rather than silently changing the whole coaching curriculum.
- **Matching is not linguistic tokenization.** Turn preparation splits on whitespace
  and lowercases. Candidate comparison uses ASCII case-insensitive equality. Attached
  punctuation, canonical Unicode differences, multiword phrases and unspaced Chinese
  are not handled consistently. Do not enlarge literal lists to simulate a parser.
  Any normalization for matching must use a derived view, never rewrite source spans.
- **Coverage is explicit but incomplete.** Arabic starters are authored only for
  Modern Standard Arabic. Any pair containing Levantine yields zero cards, including
  Hindi/Malayalam paired with Levantine as explanation variety. Tests explicitly
  retain that gap; no dialect translations were invented during this addition.
- **Some metadata is descriptive only.** Family, script `cursive`, `shaping` and
  `has_case` are not a generalized rendering engine. The UI detects supported shaping
  scripts in source text; script size/direction resolve from content. Traits currently
  offer little retrieval value because shared goals have empty trait lists. Avoid
  adding decorative metadata or implying those booleans implement segmentation.
- **Starter duplication has a reason but needs clearer names.** `preview` is selected
  from the target language; `translation` from the explanation language's copy of
  the same topic. Equal strings within one document are expected. The contract
  assumes equivalent sample meanings across languages without validating semantics.
  A future authoring change could name the common sample once; it must preserve
  independently authored variety coverage and inspectable translations.
- **Partner prose is uneven.** Some existing personas use English biographies, others
  local-language biographies, and several have strongly stylized opinions. This is
  prompt data, not a localization contract. No wholesale persona rewrite was made.
- **Language quality is not schema validity.** Existing varieties are often only
  region names, with empty sources/guidance. All shipped language identities remain
  `needs_review`. New starter phrasing and scheme examples require speaker review;
  default partners are fictional. The audit is not a grammar/translation review of
  every existing sentence or a proof of per-variety AI quality.

## Integration and rendering limits

`hi` and `ml` map to language tags and transcription request parameters. Groq's
[API reference](https://console.groq.com/docs/api-reference) accepts ISO-639-1 input
language codes; a configured route/model still needs actual speech verification.
No paid inference or deployment was performed. Speech synthesis quality is likewise
unverified. Existing Latin font stacks fall back to platform fonts for Indic text;
font coverage, line height and ligatures need native-device inspection. No arbitrary
font-size multiplier was introduced: both new scripts use shared 1.0 defaults.

DOM and pure-function tests verify intact text nodes and anchors, not the appearance
of platform glyphs. Native tests verify Unicode boundaries, not word-level analysis
quality. Rebuild the native app to see the new bundled language definitions.

## Verification

- `npm run languages:check`: passed; nine bundled learning languages, seven
  interface locales, 948 messages per locale, and 25 configuration tests.
- `cargo test --manifest-path native/Cargo.toml --lib language::`: 51 passed,
  including Indic fixtures and the existing Unicode 17 conformance suite.
- Full `npm test`: 116 files, 730 tests passed.
- `npm run build`: passed; existing Vite large-chunk advisory remains.
- Regenerated contracts through the Rust exporter (learning-content hash changed);
  `npm run contracts:check` passed. No serialized type/schema changes.
- Rust formatting, `git diff --check`, and `npm run docs:links` passed.
- No native app launch, visual device check, live inference, deployment, version
  bump, commit or push was performed. Changes remain available in the working tree.
