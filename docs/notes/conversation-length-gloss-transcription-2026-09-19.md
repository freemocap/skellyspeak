# Reply length, gloss truncation and transcription

## Observed

Read the local native/frontend JSONL streams since run `native-1789861244265-14144`
through `native-1789862111133-46148`, and the latest saved messages and failed gloss
attempt in the workspace, read-only. Conversation-15 produced a three-paragraph
beginner reply. Its persona gloss failed with `finish_reason=length`, 2048 output
tokens and `gloss_invalid_termination`. The learner transcript contained repeated
literal hesitation fillers. No conversation text or credentials are copied here.

## Implemented

- Beginner replies request one short sentence, with a second only for an easy question.
- Gloss structured requests receive 8192 output tokens; other requests retain 2048.
  Native diagnostics use the gloss allowance when reporting truncation. Local server
  defaults accept up to 32768, matching deployment configuration. Incomplete output
  still fails validation; there is no automatic retry or partial publication.
  Limit errors now name the output limit and offer an explicit retry.
- Scribe requests non-verbatim transcription and records `no_verbatim=true` in receipts.
  This removes fillers and false starts, not just their visual display. Transcript-based
  analysis cannot measure omitted disfluencies. [@elevenlabs_non_verbatim]

## Runtime limits

Native changes require rebuilding/restarting. Hosted transcription needs a server
deployment; none is authorized or performed here. Existing messages are unchanged.
These changes do not prove live model compliance or prevent every possible gloss truncation.

## Verification

- Native library: 428 passed, one live-provider test ignored; the subsequent gloss
  error-message change passed all four colocated gloss tests.
- Language/content and contract checks passed.
- ElevenLabs adapter and launcher: 40 passed. The oversized-audio case uses a short
  test ID so Windows can populate `PYTEST_CURRENT_TEST`.
- The broader development suite has six Windows-specific failures in unchanged
  permission/session code (POSIX modes and `os.fchmod`). These remain unresolved.
- Repository-wide whitespace checking also reports existing generated-contract
  trailing spaces; generated files were not edited for this task.
