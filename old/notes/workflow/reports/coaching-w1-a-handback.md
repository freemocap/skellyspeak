## Hand-back: A · wave 1

Done:

- Scheme registry and exact contract functions in `src-tauri/src/languages.rs`: `RomanizationScheme`, `romanization`, `romanization_guidance`, `assessment_guidance`. Frontend projection now carries `ala-lc-arabic` / `pinyin` ids. Unknown language or invalid compiled scheme fails. Each scheme has cited guidance, at least five examples, and `needs_review` comments.
- `src-tauri/src/linguistics/adapter.rs` appends target-language guidance, replacing the generic romanization phrase. Prompt template is v5; corresponding existing adapter test updated.
- `src/domain/language/sentences.ts` recognizes Arabic question marks in token grouping and translation splitting; attached and separate marks covered.
- `src-tauri/src/languages_citation_tests.rs` validates bibliography required fields, duplicate keys, scheme citation resolution and malformed fixtures. Frozen Arabic prompt guidance in `src-tauri/src/language_fixtures/arabic-romanization-prompt.txt`; test verifies source remains exact.
- `references.bib` adds `ala_lc_arabic` and `pinyin_orthography2012`; citation test found and repaired missing URL/DOI for `ryding2005` and duplicate `koenecke2024` (retained richer entry and both usage pointers).

Learner agency: language rules are explicit, named and inspectable, separate from task policy. Assessment protects the learner's actual words. Romanization is a separate annotation; it never rewrites source evidence. Prompt tests establish contract delivery, not linguistic validity or proficiency.

Not done / why: No live inference or expert validation. Linguistic content deliberately remains needs_review. Whole-tree verification coordinated by integrator to avoid racing other agents' active changes.

Verification:

- `npm test -- src/domain/language/sentences.test.ts`: 10 passed.
- `cargo test --manifest-path src-tauri/Cargo.toml --lib languages::`: 9 passed (includes citation parser and Arabic prompt snapshot).
- `cargo test --manifest-path src-tauri/Cargo.toml --lib linguistics::adapter::tests`: 21 passed.
- Owned Rust files formatted with rustfmt. Integrator owns final build/clippy/full-test/contracts gate.

Paid inference: none. No application data reset and no Git writes.

Contract drift / verified corrections:

- API shapes match contracts. The explanatory contract comment about ʿ/ʾ and sun letters is not literal normative text. The current primary [LOC Word table](https://www.loc.gov/catdir/cpso/romanization/arabic.docx), resolved through [LOC source index](https://www.loc.gov/catdir/cpso/romansource.html), uses distinct ‘ and ’ signs. Implemented those source signs, omitted initial hamzah, kept unassimilated `al-` before sun letters (`al-shams`), and used `á` for final alif maqṣūrah. These avoid mixing ALA-LC with other named systems.
- The table specifies tā’ marbūṭah h/t/tan by context; normally omits noun/adjective case vowels and tanwīn, with pronominal/verse and defective-root/adverbial exceptions. Guidance includes those exceptions and wāw/yā’ shaddah distinctions.
- [GB/T 16159–2012 §6.5](https://www.moe.gov.cn/ewebeditor/uploadfile/2015/01/13/20150113091717604.pdf) leaves neutral tone unmarked. Therefore app policy “always tone marks” means every lexical tone 1–4, with neutral tone correctly unmarked. App requires diacritics over numeric or omitted alternatives. Guidance uses lexical yī/bù rather than contextual sandhi, per ordinary orthography.

Exact assessment guidance handed to B:

> For Arabic learner evidence, copy quotes character-for-character: never add diacritics, normalize letters, correct spelling, or translate quotes. Put corrections only in correction.

Change requests: Integration should record the primary-table corrections in contracts/design notes, especially any older illustrative sun-assimilation or symbol assumptions. No additional implementation dependency remains.

Discovered: Existing bibliography contained missing metadata and a duplicate key, now fixed by the guard. Old LOC `.doc` is 404 and PDF access was 403; the live source index links `.docx`.

Inferred vs read: Read actual LOC source-document XML text in full, including rules and examples; read MOE indexed primary §6.5 excerpts (direct PDF retrieval timed out). Bibliography review remains `abstract` as required by brief. Examples not copied verbatim from the table (e.g. al-shams) are applications of its rules, still needs_review. Philosophical core, work plan, contract, integration brief and assigned source files read this wave.
