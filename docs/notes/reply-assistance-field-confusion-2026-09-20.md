# Reply-assistance field confusion — September 20, 2026

## Observed records

Read the development SQLite database in read-only mode. The failures at
18:08:23 UTC (Arabic) and 18:09:59 UTC (Mandarin) retained structured responses
with source-script text copied into both `text` and `romanization`. Both responses
also supplied Latin reading aids in `pronunciation`. This is field confusion,
not failure to generate Latin text. Explanation and translation fields remained
English. The native validator rejected the entire assistance result.

The failed Arabic system message is byte-identical to the four successful Arabic
requests at 17:28:57, 17:29:28, 17:30:18 and 17:43:58 UTC. Prepared-request logs
also have identical system-prompt/schema/configuration hashes, temperature 0.7,
custom route and 2048 output limit. Recorded actual model is Gemini 2.5 Flash.
The user payload differed normally with the exchange. It has the expected
actualPartnerReply/latestLearnerInput/precedingExchange/difficulty/input fields;
system instructions and user data occupy their intended separate message roles.
The Mandarin failure had no preceding exchange, so contamination from an earlier
bad assistant reply is not necessary for this failure.

Native payload construction forwards the named schema and message roles. Native
completion decoding extracts the returned content string without renaming these
JSON fields. No application-side field swap was found. This does not establish
what occurred inside the external custom service/provider.

## Changes and interpretation

Commit 87034cd (September 18) introduced the script validation, field descriptions
and explicit field-language instructions after prior swapped-field problems.
Before that check, source-script romanization could pass the existing generic
string validation. This explains why the failure now becomes an explicit error;
it does not prove when the model first made the mistake.

Commit e54e311 (September 20) changed learner-feedback instructions; assistance's
shared system header changed from v4 to v5 but its task wording did not change.
The successful and failed Arabic requests already share that v5 prompt. The
subsequent UI formatting work did not change the requests behind these records.

The old prompt packages the entire language guidance object (including assessment
and segmentation) under “Writing guidance for quoted target text only.” It then
supplies broad target-script generation rules alongside transliteration rules,
and ends with an incomplete field-language summary that omits romanization and
pronunciation. This is an avoidable scoping ambiguity consistent with the observed
field confusion, not proof of the model's internal causal process. It was too
strong to dismiss the issue as simply a model ignoring a clear instruction.

## Implemented correction

Reply assistance now has its own v6 system instruction with language guidance
bound to exact output fields. Target writing/pragmatics apply to reply text,
frames and starters; explanation writing applies to explanations/translations;
romanization guidance belongs to the romanization field. Pronunciation's distinct
purpose is explicit. Assessment/evidence-copying and segmentation guidance are
excluded from this task. Data roles, schema shape, validation, response retention,
models, temperature and no-automatic-retry policy remain unchanged.

## Verification and limits

Seven native coaching tests pass, including a new Arabic/Mandarin/Spanish prompt
projection test for field-specific guidance and separation of source data from
system instructions. Existing rejection and valid reading-aid tests pass.
`git diff --check` passes. No live inference, application restart, commit or deploy
was performed. This verifies request construction; a reduction in model failure
frequency requires a live comparison and is not claimed here. Old failed receipts
retain the original requests and responses.
