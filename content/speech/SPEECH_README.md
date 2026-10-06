# speech

`speech-routing.yaml` declares providers, tasks, models and routing defaults. Language-owned preferences refer to this catalog. Credentials never belong here.

The bundled synthesis order is Eleven v4 Turbo, then Eleven v3. Selection requires
a listed language capability and an available server model. Irish selects v3;
Cantonese requires Turbo. A provider failure is never retried on another model.
The server implements each model's timestamp endpoint and advertises both when
credentials and a voice are configured. Availability is not a voice-quality test.

The service uses estimated per-model allowances, retained separately from unknown
actual billing. See [implementation and verification](../../docs/notes/cantonese-speech-support-audit.md).
