# languages

One directory per target language. `<language>-language.yaml` declares language identity, varieties, writing systems, conversation starters and practice material. `skills/<skill>/` holds `<language>-<skill>-assessment.yaml` and `<language>-<skill>-explained-in-<explanation>.yaml`. Start from `__TARGET_LANGUAGE_TEMPLATE/`; replace every placeholder.

Declare the language's source explanation edition in `policies/guide-authoring.yaml`.
Author all eight assessments and source guides, including variety dispositions.
English, Spanish, Arabic and Cantonese are the declared explanation editions.
The source edition and Cantonese edition are bundled for every learning language;
Cantonese also has all eight shared concept guides. These Cantonese documents are
authored during development and loaded from the bundle without a translation call.
Other missing translations can be generated on demand from the source edition;
missing source material fails. See the
[Cantonese interface and explanation report](../../docs/notes/cantonese-interface-and-explanations.md).

## Variety coverage

Every variety needs a description of its actual coverage, not a repeated place name.
Broad country/region profiles do not promise one local accent. Shared generation
and assessment policy lives in `policies/teaching-policy.yaml`: keep the selected
usage consistent, avoid forced regional slang, preserve quotations, and distinguish
valid variation from errors. A single-variety language may inherit this policy
without inventing additional overrides.

Where a language offers multiple varieties, each alternative must supply cited
`target_writing` and `explanation_writing` guidance. Keep the linguistic rule in
both roles aligned: explanation selection is independent of target selection.
Include a few useful contrasts and their limits, rather than exhaustive lists or
claims that one region has uniform speech. Keep shared orthography rules with the
orthography, grammatical/lexical distinctions with the variety, and skill-specific
evidence rules in the assessment/guide files. Instruction examples illustrate usage;
they do not force the model to change the conversation topic.

`needs_review` is retained until linguistic review has occurred. Validation and
prompt coverage tests prove configuration and wiring, not naturalness or speech
accuracy. See [the existing-variety cleanup](../../docs/notes/existing-language-variety-cleanup.md)
for scope, source limitations, and the [Cantonese implementation and verification limits](../../docs/notes/cantonese-speech-support-audit.md).
