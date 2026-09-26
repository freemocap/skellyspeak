# Supported-language guide coverage

Implemented locally, September 25, 2026. Required scope for the skills/XP PR.

## Authored coverage

18 languages, 22 varieties, 216 language-level skill guides and 264 composed variety/skill combinations. The source contains 451 structured translated examples. Shared skill IDs and progression remain unchanged.

| Language | Varieties | Skills |
| --- | --- | --- |
| [Arabic](../../../content/languages/arabic.yaml) | Levantine, Modern Standard | 12 |
| [English](../../../content/languages/english.yaml) | United States, United Kingdom | 12 |
| [French](../../../content/languages/french.yaml) | France, Canada | 12 |
| [German](../../../content/languages/german.yaml) | Germany | 12 |
| [Hindi](../../../content/languages/hindi.yaml) | India | 12 |
| [Indonesian](../../../content/languages/indonesian.yaml) | Indonesia | 12 |
| [Irish](../../../content/languages/irish.yaml) | Ireland | 12 |
| [Italian](../../../content/languages/italian.yaml) | Italy | 12 |
| [Japanese](../../../content/languages/japanese.yaml) | Japan | 12 |
| [Korean](../../../content/languages/korean.yaml) | South Korea | 12 |
| [Malayalam](../../../content/languages/malayalam.yaml) | Kerala | 12 |
| [Mandarin](../../../content/languages/mandarin.yaml) | Mainland China | 12 |
| [Portuguese](../../../content/languages/portuguese.yaml) | Brazil | 12 |
| [Russian](../../../content/languages/russian.yaml) | Russia | 12 |
| [Spanish](../../../content/languages/spanish.yaml) | Mexico, Spain | 12 |
| [Turkish](../../../content/languages/turkish.yaml) | Türkiye | 12 |
| [Ukrainian](../../../content/languages/ukrainian.yaml) | Ukraine | 12 |
| [Vietnamese](../../../content/languages/vietnamese.yaml) | Vietnam | 12 |

New guides contain separate compact assessment text, explanatory Markdown and target-language examples. Existing Spanish and Levantine content is preserved; standard Arabic has its own explicit section under the shared Arabic core. Mandarin now has structured examples and fuller explanations, while retaining its existing assessment wording. English and French have selected regional notes.

Every guide remains marked needs_review. These are authored drafts, not speaker-approved or empirically validated descriptions. Dialect, register, naturalness and example accuracy still require linguistic review. Complete structural coverage is not a claim that every regional distinction is documented.

## Speech eligibility

Offered languages must have declared recognition and synthesis support. Cherokee and Scottish Gaelic lacked both in the configured capability lists and were removed from the offered catalog. Irish remains supported. Unlisted-language attempts are disabled in the shared policy and generated service catalog. This replaces the earlier best-effort allowance; acceptance of a language code was not proof of usable speech support.

The model language lists were checked against the existing catalog sources [@whisper_language_tokens], [@elevenlabs_scribe_languages_20260923], [@elevenlabs_v3_languages_20260923]. Listed support does not guarantee equal dialect coverage or pronunciation quality. No paid speech requests were made in this pass. Existing user records were not reset.

## Verification

Catalog tests require both listed speech capabilities for each offered language. Composition tests require every offered variety to produce twelve assessor entries and twelve Markdown guides containing examples. Server tests reject unlisted speech languages before provider dispatch.

Final checks passed: 673 native tests (3 opt-in ignored), 1,307 UI tests, and
602 server tests (7 emulator-dependent skipped). Frontend build, strict native
lint, formatting, generated-contract consistency and workbench checks also passed.
Local HTTP fixtures required socket permissions; the initial sandbox failures
were rerun with those permissions. Running-app visual and linguistic review
remain separate from these automated checks. No commit or deployment was made.
