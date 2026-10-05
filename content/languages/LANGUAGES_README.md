# languages

One directory per target language. `<language>-language.yaml` declares language identity, varieties, writing systems, conversation starters and practice material. `skills/<skill>/` holds `<language>-<skill>-assessment.yaml` and `<language>-<skill>-explained-in-<explanation>.yaml`. Start from `__TARGET_LANGUAGE_TEMPLATE/`; replace every placeholder.

Declare the language's source explanation edition in `policies/guide-authoring.yaml`.
Author all eight assessments and source guides, including variety dispositions.
English, Spanish and Arabic are the bundled translation target. Missing translations
can be generated on demand from the source edition; missing source material fails.
