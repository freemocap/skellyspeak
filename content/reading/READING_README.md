# Bundled reading content

`english.json`, `spanish.json`, `arabic.json` and `french.json` extend the pilot
through the same startup import. Together the five files contain 8,790 directed
records. Exact sample-token coverage is complete for these four languages in the
skill guides, including inline examples across explanation editions. US/UK English,
Spain/Mexico Spanish, Levantine/MSA Arabic and France/Canada French are kept distinct.
Explanations use the other three pilot varieties. Additional everyday forms are
editorial selections, not ranked top-1,000 lists.

Expansion packages are `editorially_reviewed`: gpt-6-luna authored drafts and the
integration agent reviewed and corrected the translation tables, with targeted
reference checks. This does not certify every gloss against a published dictionary
or native-speaker review. Entry provenance points to the language review note.
Compact alternatives remain dictionary fallbacks, not sentence-specific analysis.
No sentence translations, analyses, audio or pronunciation fields were added.

`preload-pilot.json` retains 96 source-checked dictionary gloss records: eight selected source
forms each for United States English, Spain Spanish, Levantine Arabic and France
French, each explained in the other three varieties. It is a small integration
pilot, not a frequency list or a complete dictionary. Entries select one sense;
they do not exhaust every meaning of a surface form.

The initial model draft was produced by `gpt-6-luna`. The shipped records were
edited after source checking, with explicit variety IDs and grammatical ambiguity.
`source_checked` means the cited references were consulted for the selected lexical
meaning or grammatical distinction. It does not mean native-speaker certification
or independent verification of every directed translation. Cross-language glosses
are editorial syntheses. Pronunciation and romanization are intentionally absent.

The Arabic water entry uses the attested spelling `ميّة`. Unvowelled spellings and
other dialect variants are not implicitly equivalent for matching. The ability
entries preserve subject ambiguity rather than assuming every form means “I can.”
French size words depend on the noun; the relevant glosses retain that distinction.

## Provenance and reference terms

The authored package uses the repository's AGPL-3.0-or-later license. Reference
publications retain their own copyrights and terms; the package license does not
relicense those publications. References were consulted for individual lexical
facts. Dictionary example sentences, extended definitions and source datasets
are not bundled. A larger imported third-party dataset needs its own license
review and notices; this pilot is not permission to extract entire dictionaries.

Each entry records the URLs supporting its selected sense. Bibliography entries
at the repository root document the scope of review:

- [@readingPreloadReference120261007] — [reference](https://dictionary.cambridge.org/us/dictionary/english-spanish/water)
- [@readingPreloadReference220261007] — [reference](https://resources.lingualism.com/wp-content/uploads/Mido-in-Levantine-Arabic-Glossary-Lingualism.pdf)
- [@readingPreloadReference320261007] — [reference](https://dictionary.cambridge.org/us/dictionary/english-french/water)
- [@readingPreloadReference420261007] — [reference](https://dictionary.cambridge.org/us/dictionary/english-spanish/house)
- [@readingPreloadReference520261007] — [reference](https://dictionary.cambridge.org/us/dictionary/english-french/house)
- [@readingPreloadReference620261007] — [reference](https://dictionary.cambridge.org/us/dictionary/english-spanish/book)
- [@readingPreloadReference720261007] — [reference](https://www.collinsdictionary.com/dictionary/english-french/book)
- [@readingPreloadReference820261007] — [reference](https://dictionary.cambridge.org/us/dictionary/english-spanish/tomorrow)
- [@readingPreloadReference920261007] — [reference](https://www.collinsdictionary.com/dictionary/english-french/tomorrow)
- [@readingPreloadReference1020261007] — [reference](https://www.collinsdictionary.com/us/dictionary/english-spanish/here)
- [@readingPreloadReference1120261007] — [reference](https://dictionary.cambridge.org/fr/dictionnaire/anglais-francais/here)
- [@readingPreloadReference1220261007] — [reference](https://dictionary.cambridge.org/us/dictionary/english-spanish/big)
- [@readingPreloadReference1320261007] — [reference](https://www.collinsdictionary.com/dictionary/english-french/big)
- [@readingPreloadReference1420261007] — [reference](https://dictionary.cambridge.org/us/grammar/british-grammar/can)
- [@readingPreloadReference1520261007] — [reference](https://www.spanishdict.com/conjugate/puede)
- [@readingPreloadReference1620261007] — [reference](https://progress.lawlessfrench.com/revision/grammar/conjugate-pouvoir-in-le-present-present-tense)
- [@readingPreloadReference1720261007] — [reference](https://dictionary.cambridge.org/us/dictionary/english-spanish/bank)
- [@readingPreloadReference1820261007] — [reference](https://dictionary.cambridge.org/us/dictionary/english-french/bank)
- [@levantongueAbilityTeaching20261007] — [Levantine ability](https://thelevantongue.com/levantine-arabic/ability-inability-levantine-arabic/)

## Package maintenance

Change the package version whenever changing package data after release. Formatting
alone does not change the digest of the parsed package.
Startup checks the installed version and digest, validates the records, and
transactionally replaces only records owned by that package. Reading lookup uses
the installed database rows. It does not read this JSON file.

Native validation accepts only source-checked or editorially reviewed packages,
and rejects drafts, duplicate IDs, missing provenance,
unknown varieties and unsupported schemas. Native tests cover import lifecycle
and indexed lookup; UI tests cover dictionary precedence and compact hover/tap behavior.
Run `node docs/notes/reading-expansion/audit.ts` from the repository root to check
exact sample-token coverage, duplicate keys and display-gloss compactness.
See [the implementation plan](../../docs/notes/reading-preload-plan.md) for scope
and verification results.
