# Repository file-size inventory

Status: scan snapshot, 2026-09-15. No implementation changes or file splits.

## Rules and scope

- **Under 500 lines:** good by size; this does not certify cohesion or correctness.
- **500–999 lines:** danger zone; review responsibilities before further growth.
- **1,000+ lines:** requires decomposition into coherent files.
- Counts include blank lines, comments and colocated tests; an unterminated final line counts.
- Enumerated with `rg --files --hidden -g '!.git/**' -g '!old/**'`, respecting ignore rules. Archived old/, dependencies, build outputs and ignored private files are excluded.
- Authored source includes code, styles, SQL and build scripts. Android Kotlin/build customizations are included; generated UI/schema outputs and vendor wrappers are separate.
- Website source is included but its documentation remains unaudited. Markdown, bibliography, data and configuration are reported separately, not assigned code-splitting obligations.
- The complete text-file inventory is in [large-file-inventory.json](large-file-inventory.json). This report and its JSON are excluded from their own snapshot.

## Authored source summary

| Area | Under 500 | 500–999 | 1,000+ | Total |
| --- | ---: | ---: | ---: | ---: |
| docs | 8 | 2 | 0 | 10 |
| native | 94 | 17 | 4 | 115 |
| server | 62 | 2 | 0 | 64 |
| tools | 27 | 0 | 0 | 27 |
| ui | 289 | 5 | 1 | 295 |
| **Total** | **480** | **26** | **5** | **511** |

## Requires decomposition: 1,000+

| Lines | File |
| ---: | --- |
| 1,717 | [native/src/storage/store.rs](../../native/src/storage/store.rs) |
| 1,501 | [native/src/application/mod.rs](../../native/src/application/mod.rs) |
| 1,437 | [native/src/learning/lessons.rs](../../native/src/learning/lessons.rs) |
| 1,052 | [ui/src/styles/features/conversation/conversation.css](../../ui/src/styles/features/conversation/conversation.css) |
| 1,017 | [native/src/ai/transport/provider.rs](../../native/src/ai/transport/provider.rs) |

## Danger zone: 500–999

| Lines | File |
| ---: | --- |
| 997 | [native/src/model.rs](../../native/src/model.rs) |
| 984 | [native/src/ai/connections/access.rs](../../native/src/ai/connections/access.rs) |
| 886 | [native/src/ai/transport/speech_provider.rs](../../native/src/ai/transport/speech_provider.rs) |
| 830 | [native/src/configuration/mod.rs](../../native/src/configuration/mod.rs) |
| 771 | [server/app/main.py](../../server/app/main.py) |
| 739 | [native/src/language/linguistics/adapter_tests.rs](../../native/src/language/linguistics/adapter_tests.rs) |
| 722 | [ui/src/features/conversation/ConversationPage.tsx](../../ui/src/features/conversation/ConversationPage.tsx) |
| 714 | [native/src/configuration/validation.rs](../../native/src/configuration/validation.rs) |
| 713 | [native/src/ai/hosted/mod.rs](../../native/src/ai/hosted/mod.rs) |
| 687 | [docs/website/static/coaching-plan.html](../../docs/website/static/coaching-plan.html) |
| 672 | [native/src/ai/transport/grouped.rs](../../native/src/ai/transport/grouped.rs) |
| 666 | [ui/src/features/settings/SettingsModal.tsx](../../ui/src/features/settings/SettingsModal.tsx) |
| 642 | [ui/src/styles/foundations/tokens.css](../../ui/src/styles/foundations/tokens.css) |
| 635 | [native/src/storage/factory_reset.rs](../../native/src/storage/factory_reset.rs) |
| 625 | [ui/src/styles/features/conversation/practice.css](../../ui/src/styles/features/conversation/practice.css) |
| 601 | [native/src/diagnostics/mod.rs](../../native/src/diagnostics/mod.rs) |
| 596 | [native/src/learning/learner/learner_state.rs](../../native/src/learning/learner/learner_state.rs) |
| 585 | [server/tests/accounting/test_quota.py](../../server/tests/accounting/test_quota.py) |
| 565 | [docs/website/src/pages/download.css](../../docs/website/src/pages/download.css) |
| 552 | [ui/src/features/conversation/ConversationPage.conversation.test.tsx](../../ui/src/features/conversation/ConversationPage.conversation.test.tsx) |
| 541 | [native/src/learning/coaching/mod.rs](../../native/src/learning/coaching/mod.rs) |
| 541 | [native/src/speech/analysis/fluency.rs](../../native/src/speech/analysis/fluency.rs) |
| 532 | [native/src/language/linguistics/tests.rs](../../native/src/language/linguistics/tests.rs) |
| 519 | [native/src/partners/generation/mod.rs](../../native/src/partners/generation/mod.rs) |
| 509 | [native/src/configuration/tests.rs](../../native/src/configuration/tests.rs) |
| 502 | [native/src/language/linguistics/adapter.rs](../../native/src/language/linguistics/adapter.rs) |

## Large non-code files: separate review

These are not automatic code-refactoring targets. Generated output must be changed through its source; data and documentation need their own ownership review.

| Lines | Category | File |
| ---: | --- | --- |
| 19,668 | lockfile or vendor wrapper | [docs/website/package-lock.json](../../docs/website/package-lock.json) |
| 6,722 | lockfile or vendor wrapper | [native/Cargo.lock](../../native/Cargo.lock) |
| 3,587 | lockfile or vendor wrapper | [package-lock.json](../../package-lock.json) |
| 1,205 | lockfile or vendor wrapper | [server/uv.lock](../../server/uv.lock) |
| 849 | data or configuration | [content/config/constructs/core.yaml](../../content/config/constructs/core.yaml) |
| 842 | data or configuration | [ui/src/domain/localization/locales/ar.json](../../ui/src/domain/localization/locales/ar.json) |
| 842 | data or configuration | [ui/src/domain/localization/locales/de.json](../../ui/src/domain/localization/locales/de.json) |
| 842 | data or configuration | [ui/src/domain/localization/locales/en.json](../../ui/src/domain/localization/locales/en.json) |
| 842 | data or configuration | [ui/src/domain/localization/locales/es.json](../../ui/src/domain/localization/locales/es.json) |
| 842 | data or configuration | [ui/src/domain/localization/locales/fr.json](../../ui/src/domain/localization/locales/fr.json) |
| 842 | data or configuration | [ui/src/domain/localization/locales/pt.json](../../ui/src/domain/localization/locales/pt.json) |
| 842 | data or configuration | [ui/src/domain/localization/locales/zh.json](../../ui/src/domain/localization/locales/zh.json) |
| 796 | data or configuration | [native/src/language/linguistics/fixtures/GraphemeBreakTest-17.0.0.txt](../../native/src/language/linguistics/fixtures/GraphemeBreakTest-17.0.0.txt) |
| 700 | documentation or bibliography | [docs/website/docs/coaching-plan.md](../../docs/website/docs/coaching-plan.md) |
| 661 | data or configuration | [LICENSE](../../LICENSE) |
| 558 | documentation or bibliography | [README.md](../../README.md) |
| 542 | generated | [ui/src/generated/skill-catalogs/catalog.json](../../ui/src/generated/skill-catalogs/catalog.json) |

## Next cleanup planning

First cleanup implemented: [conversation execution split](execution-file-split.md).
Its 33 replacement files are all under 500 lines; this inventory reflects that split.

Start with the 1,000+ list, then review the danger zone. Propose responsibility boundaries before extracting implementations; do not shorten files by compressing formatting or moving all tests into another giant file. Preserve existing tests and serialized contracts. This scan establishes a baseline, not a CI gate.
