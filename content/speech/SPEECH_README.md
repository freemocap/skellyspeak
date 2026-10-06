# speech

`speech-routing.yaml` declares providers, tasks, models and routing defaults. Language-owned preferences refer to this catalog. Credentials never belong here.

The bundled synthesis order is Eleven v4 Turbo, then Eleven v3. Selection requires
a listed language capability and an available server model. Irish selects v3;
Cantonese requires Turbo. A provider failure is never retried on another model.
The server implements each model's timestamp endpoint and advertises both when
credentials and a voice are configured. Availability is not a voice-quality test.

Synthesis sends exact source text without a constructed accent prefix. Listening
comparisons reproduced a British accent with v3 on an Arabic reply and accepted
v4 Turbo, while repeated v4 plain-source English controls had no duplication.
Format 54 restores saved v3 selections to v4 once; later learner selections remain
respected. This is bounded listening evidence, not a guarantee for every utterance.
See the [Arabic investigation](../../docs/notes/arabic-speech-investigation-2026-10-06.md).

The service uses estimated per-model allowances, retained separately from unknown
actual billing. See [implementation and verification](../../docs/notes/cantonese-speech-support-audit.md).
