# Provider error redaction audit fix — 2026-09-12

Implemented A03 in `src-tauri/src/hosted.rs`.

Non-429 response decoding no longer copies any remote `detail`, unknown `code`, response body, or unvalidated request ID into an AppError. Known status/code pairs select client-authored guidance; all other statuses use client-authored status guidance. Valid 32-hex `X-Request-ID` values remain available for troubleshooting. This shared decoder is also used by grouped Custom URL requests.

Verification:

- Three refusal decoder tests passed. They cover known codes with hostile details, mismatched status/code combinations, malformed/unreadable bodies, nested detail values and unknown codes across nine HTTP statuses.
- A loopback Custom URL grouped refusal regression passed. It returns a synthetic credential/message echo in HTTP 400, finishes a real persisted operation with the resulting error, reopens its temporary SQLite workspace and verifies error/context redaction. It tests both valid and invalid request ID headers. Loopback execution required sandbox escalation; authorization was granted. No external service calls occurred.

The first persistence assertion was too broad (`private` also occurs in legitimate prompt instructions); it was corrected to check each exact secret/content sentinel. The test now verifies the intended data boundary without mistaking existing prompt text for leakage.
