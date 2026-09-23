# Terminal and diagnostic redaction

## Implemented

The development launcher previously mirrored the saved diagnostic record to the
terminal. The shared policy classified every URL and every 48-character identifier
as a secret, obscuring Vite's local address and useful build identifiers.

`tools/run-log.ts` now formats terminal output separately from saved diagnostics.
Terminal output retains ordinary content, URLs, paths and long identifiers.
Known environment credentials and recognizable credential patterns remain masked.
URL user information, query strings and fragments are masked. The two broad
heuristics are marked `terminal: false` in the authored diagnostic policy;
content rules also remain diagnostic-only. Generated runtime policy copies are
updated through the exporter. Persisted diagnostic redaction remains in effect.
Multiline PEM continuation lines are now masked in both launcher sinks.

## Reviewed boundaries

Conversation message rendering and the activity model-response inspector consume
product content separately from diagnostic formatting. They were not changed.
Error details and exported diagnostics retain their separate content protections.
This is a focused launcher fix and display-boundary review, not certification of
every redaction path in the native, Android and hosted runtimes. Generic pattern
matching cannot identify every arbitrary unknown credential; producer-side
separation of credentials, product content and diagnostic metadata remains needed.

## Verification

Eight launcher tests pass, covering split credentials, private-key continuations,
UTF-8 boundaries, usable local IPv4/IPv6 URLs, ANSI Vite output, content and hash
retention in the terminal, and credential masking. Launcher TypeScript checking
and generated diagnostic-policy consistency checking pass. No app deployment or
Git commit was performed.
