# Message feedback restoration

Status: implemented; local service round trip verified.

## Implemented behavior

- Automatic turns request rich correction feedback as well as the independent
  numeric ratings and skill-presence assessment. Correction feedback does not
  publish skill credit.
- Message feedback, the coach panel and the edit view render the correction and
  explanation even when scores exist. The score-to-chat explanation button is
  removed. Original and corrected phrases use the shared target-language controls
  and existing strikeout/correction styling.
- When no correction is returned, the view distinguishes no correction identified
  from partial or unrecoverable meaning. Errors remain visible errors.
- Add context is an always-visible compact textarea that expands on focus or when
  it contains text. Submission stays in the feedback window.
- Clarification reruns only the source-bound correction operation through the
  existing transactional command, admission, retry and publication mechanisms.
  It preserves the transcript, partner reply, numeric ratings and earned XP.
- Understanding has two outcomes: understood and confused. A relevant follow-up
  question is evidence of understanding, not a separate reaction category.
- Error categories are bounded descriptive text, not ASCII identifiers. Exact
  source quotes, candidate membership and correction validation remain enforced.

## Verification

- Native conversation integration suite: 145 passed, including scoped reassessment,
  duplicate receipt replay, stale completion rejection and persistence after reopen.
- UI feedback/reaction/message suites: 91 passed. A regression test supplies scores
  and correction feedback together and checks the visible strikeout, correction,
  explanation and clarification submission without opening coach chat.
- Type, style, localization and generated-contract checks passed.
- Local server restarted at port 8765. Desktop settings confirmed that address.
- A live Spanish tense-error test received a coherent follow-up question classified
  as understood. Its correction exposed an overly restrictive category validator;
  that validator was fixed and a descriptive-category regression test passed.
- Two saved development reactions using retired categories were deleted under the
  workspace lock. Conversation text and XP were retained. No conversion or
  compatibility path was added.

## Local completion check

The latest signed development build was loaded. The always-visible context field
and its focus expansion were inspected in the desktop app. Continued desktop
input was stopped because the learner was actively editing the same conversation.

An opt-in smoke test used a disposable workspace and the application’s structured
request transport through `http://127.0.0.1:8765/v1/operations`. The first response
provided an explicit correction, exact source quote and explanation. A second
request clarified that the intended subject was “she” rather than “I”; the
correction changed, the note persisted, and the source and XP were unchanged.
Both requests completed and validated successfully. Run it with:

```sh
cargo test --manifest-path native/Cargo.toml --lib local_feedback_and_clarification_round_trip -- --ignored
```

This check makes paid requests through the running local server. The ordinary
suite skips it. The final full native regression run passed 605 tests, with two opt-in tests
skipped. The conversation suite passed all 145 tests. No deployment or commit was
performed. A full uninterrupted desktop clarification round trip was not claimed;
that round trip was verified in the isolated workspace instead.
