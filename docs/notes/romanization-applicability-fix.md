# Romanization applicability — implemented 2026-09-18

## Behavior

Spanish and other Latin-script targets no longer display saved romanization in
word help, including expanded help. Reading preferences resolve applicability
from the selected language/variety. Pronunciation remains independently available.
Mandarin and other configured romanization systems retain their reading help.

Word-gloss prompts explicitly skip transliteration when inapplicable and constrain
the response field to null. The exact prepared schema is carried through dispatch
to HTTP, rather than reconstructed as a generic schema by the scheduler. Native
validation rejects unexpected romanization with a bounded diagnostic and span
index. Suggested replies constrain Latin-script romanization to an empty string;
lesson generation constrains it to null, with matching native validation. Lessons
remain disabled; these changes do not enable them.

Existing saved annotations are filtered for display without regeneration, deletion,
or extra model calls. This avoids requesting redundant output; no live-provider
latency, token savings, or internal model reasoning was measured.

The separate theme-toggle fix subscribes to OS appearance changes in System mode.

## Verification

- Full UI suite: 117 files, 745 tests passed. After adding the System-theme
  regression, both affected UI suites passed (17 tests).
- TypeScript application check and production UI build passed (existing bundle-size advisory remains).
- Native language suite: 53 passed; coaching: 6 passed; word-gloss execution:
  10 passed; transport: 43 passed with local loopback networking allowed.
- Regenerated native benchmark prompt/schema fixtures using their exporter.
- The full native run was not green: sandbox loopback restrictions, two old
  prompt-version assertions (updated and passed in the language rerun), an
  unrelated starter-persona vibe-count assertion (2 versus 3), and a long-running
  queue-budget test. Stopped that broad run; focused checks above completed.
- No application launch, live provider requests, deployment, or commit performed.

The existing large adapter and adapter-test files retain their established owner;
this bounded behavior fix does not perform the separately agreed file-splitting
work.

## Upstream audit — 2026-09-18

Traced editable language configuration → captured language context → prompt and
schema preparation → Dispatch → scheduler → direct/grouped provider payload →
hosted request validation and forwarding. The hosted server retains the supplied
response schema; it does not reconstruct a generic romanization schema.

- Persona conversation text: explicitly prohibits unsolicited transliteration;
  no romanization output field.
- Message word help: Latin targets receive an explicit instruction to skip
  transliteration and a null-only romanization schema before any HTTP request.
  The scheduler sends the prepared schema on all routes. No separate romanization
  operation is scheduled; translations/glosses still require their normal request.
- Current reply assistance: Latin targets receive an empty-string-only schema and
  a prompt specifying empty romanization for Latin writing.
- Lesson examples: null-only schema for Latin targets; lessons remain disabled.
- Partner profile generation: prompt says romanizedName must be null for Latin
  writing, but its generic schema still permits a string. This is prompt-level
  upstream gating, not the stronger schema gate used for message word help.
- Older coach_suggestions: generic nullable-string schema remains. New turns
  explicitly skip this operation in execution/turns.rs. Re-enabling it would
  require the same applicability gate; it is not part of the current chat flow.

The current fix skips requesting transliterated *content*, but does not omit the
romanization key: null/empty placeholders still incur a small serialization/token
cost. Complete field omission is a separate optimization, not an implemented claim.
Pronunciation is distinct and can be generated for Latin-script languages.

Added an outbound-payload regression to the word-help execution fixture, checking
both the no-transliteration instruction and null-only schema for OpenRouter,
custom and hosted routes. This uses production payload construction with local
fixtures; no live provider call or billing claim is involved.
