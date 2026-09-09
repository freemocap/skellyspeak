# Local lexical lookup and caching proposal

Historical discussion draft. The consolidated planning source is now
[the architecture redesign plan](skellyspeak-docs/docs/architecture-redesign.md).
The findings and model listings below reflect an earlier snapshot and must be
rechecked against the post-update baseline; they are not current implementation
claims or an independently active roadmap.

Discussion draft, 2026-09-09. This is proposed work, not implemented behavior.
Extends the existing “Local mechanical analysis” plan in
`skellyspeak-docs/docs/future-work.md`.

## Current code findings

- Chat learner and partner token analysis already processes a message as a batch and persists the resulting annotations with the turn. Do not replace this with per-word calls.
- `TargetText` outside annotated chat sends a missing word gloss to `word_insight`. That operation returns gloss, lemma, POS, form, role and usage, using the configured worker model. This is excessive work for showing a short meaning.
- `ReadingProvider` holds only an in-memory map of word + surrounding text, scoped by language pair. It does not survive restart, share dictionary senses across contexts, or seed itself from saved chat annotations.
- `WordInsightModal` independently invokes `word_insight`, bypassing that frontend cache. Reopening deep inspection can repeat the request.
- Markdown rendering currently wraps native prose as well as target examples in interactive text. This creates too many apparent controls and lookup entry points. Future rendering needs explicit target-language spans, not inference from arbitrary bold text.
- The code's worker default is `google/gemini-2.5-flash`; this is not a claim about the user's saved model selection.

## Proposed request path

1. Reuse annotations already saved with this exact message or suggestion.
2. Resolve from the shared Rust memory cache and durable local contextual cache.
3. Consult indexed dictionary senses, wordforms, morphology and multiword expressions.
4. Batch genuinely unresolved or ambiguous spans from the same phrase into one small-model request.
5. Save validated results and serve every reading surface from the same service.

Insertion and disclosure actions need no lookup. A known gloss should display immediately.
Full grammatical explanation remains a separate, explicitly requested operation, with
its own shared durable cache. A failed request is an error, not an empty dictionary entry.

## Two data layers, different meanings

**Lexical data:** language, lemma, surface forms, POS, senses, readings and multiword entries.
A word can have several senses. Spanish “banco” cannot be cached universally as “bank”
when it can also mean “bench”. Wordform/lemma reuse should find candidate senses, not
silently force a contextual answer.

**Contextual annotations:** target and native languages, dialect, exact source phrase,
word offsets, resolver/schema version, selected sense or generated gloss, and provenance.
Do not erase accents, case distinctions or morphology with indiscriminate normalization.
Hash source phrases for indexing if useful, but hashes do not anonymize retained text.
Record model/source versions as provenance; invalidate deliberately when contracts change.

Proposed storage: Rust-owned SQLite, with an indexed lexical database and a separate
bounded cache database under app-managed data. Include last-access timestamps, cache
size limits/eviction, transactional writes, and factory-reset cleanup. React owns only
reveal state. Deduplicate in-flight requests in Rust so different panels cannot issue the
same work concurrently. Do not hold a synchronous lock during a network request.

Seed exact-context cache entries from saved turn annotations. Import model-generated
entries as generated contextual evidence, never as authoritative dictionary facts.
Cancellation and language changes must prevent late results from entering the wrong scope.
Keep transient provider errors retryable; cache genuine dictionary misses only against
a particular installed dictionary version.

## Model shortlist to benchmark

Listings checked 2026-09-09; prices vary by provider and may change. No live language
quality or end-to-end latency benchmark has been run for this proposal.

| Candidate | Listed USD / million input / output tokens | Assessment |
| --- | --- | --- |
| [Gemini 2.5 Flash Lite](https://openrouter.ai/google/gemini-2.5-flash-lite) | 0.10 / 0.40 standard | First benchmark candidate: non-thinking by default; structured output support; cheaper than the code's worker default. |
| [Qwen3 30B A3B Instruct 2507](https://openrouter.ai/qwen/qwen3-30b-a3b-instruct-2507) | About 0.05–0.13 / 0.19–0.52 across listed providers | Non-thinking MoE, 3.3B active parameters. Compare actual provider latency and schema adherence; cheapest routing is not necessarily fastest. |
| [Gemini 3.1 Flash Lite Preview](https://openrouter.ai/google/gemini-3.1-flash-lite-preview) | 0.25 / 1.50 standard | Higher-cost comparator if the cheaper candidates fail quality requirements. Preview lifecycle requires checking before deployment. |

Introduce separate lexical model routing in Rust; do not change conversation, coaching,
and grammar models together. Preserve hosted/custom-provider routing contracts. Request
only required lexical fields, without unnecessary reasoning or long prose.

Benchmark the actual supported language pairs: Spanish/English/French, Arabic dialect
and morphology, Mandarin segmentation and tones, and non-English native glosses. Include
ambiguous senses, inflections, contractions, punctuation, idioms and multiword expressions.
Measure whole-request p50/p95 latency, parse/validation failures, retries, cost per phrase,
cache hit rate and human-reviewed gloss quality. Public token-throughput charts do not
establish tap-to-meaning latency in this app.

## Dictionary candidates

- [Kaikki / Wiktextract](https://kaikki.org/) supplies structured Wiktionary-derived data.
  Good broad-coverage candidate with senses and forms, but editions and gloss languages
  differ. Follow current raw-download guidance instead of deprecated postprocessed feeds.
- [FreeDict](https://freedict.org/) supplies offline bilingual dictionaries. Inspect coverage,
  quality and the license for each chosen dictionary rather than assuming uniform terms.
- [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?lang=en&page=cc-cedict) is a Mandarin–English
  candidate with traditional/simplified forms and pinyin. Its current download page specifies
  CC BY-SA 4.0.
- [JMdict/EDICT](https://www.edrdg.org/jmdict/edict.html) is useful if Japanese is added; it
  is not a priority for the current supported language set.

“Openly licensed” is not synonymous with public domain. Wiktionary-derived data and
CC-CEDICT have attribution/share-alike requirements. Keep source/license/version manifests
and attribution with each pack; inspect redistribution obligations before shipping.
Compile compact, indexed language packs rather than bundling raw dictionary dumps.

## Implementation order and decisions

1. Correct suggestion activation and remove unnecessary word-analysis triggers.
2. Split short lexical lookup from full explanation; add shared durable contextual caching
   and in-flight deduplication, including deep inspection.
3. Benchmark independent lexical-model routing on real phrase samples.
4. Start dictionary and morphology integration with Spanish, as the existing plan proposes;
   add Arabic and Mandarin using language-appropriate analyzers.
5. Batch the unresolved residue and measure how often interaction needs any network call.

Product decision still open: a small bundled base pack versus optional downloaded packs.
Recommendation: downloadable packs by language, with a small starter set if offline first
launch is required. Set a measured package-size budget before choosing data sources.
