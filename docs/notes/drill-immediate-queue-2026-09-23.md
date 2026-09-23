# Drill immediate clip receipts

Implemented in source, 2026-09-23. Not verified in a running native app.

Manual tap/hold stops create a UI receipt before browser audio delivery and native
transcription resolve. Automatic takes use native's queued/processing status;
spectrogram polling now runs independently so a pending spectrum request cannot
hold up subsequent take-status reads. Native status remains polled every 100 ms,
so automatic receipt timing still includes that interval and native IPC latency.

The shared TakeQueue appears above the desktop report and directly in mobile
practice. Rows use recording IDs as stable keys and replace pending status with
published results. Existing arrival/progress animation and reduced-motion handling
are reused; no clip-flight animation was added. Failures remain visible with their
details. Deleted recordings are excluded from the transient queue.

Verification: 104 tests passed across Drill, microphone recording and UI architecture.
Regression coverage holds transcription open on desktop and mobile, checks that a
visible receipt precedes the response, and verifies the same DOM row hydrates. A
separate regression holds a spectrum request open while another take arrives.
Queue tests retain queued/processing/publication identity and failed-state checks.
`npm run build` passed, including diagnostic policy, localization and TypeScript
checks. The test environment reports its existing unavailable canvas implementation;
the build reports a large JavaScript chunk warning. Device microphone timing and
visual animation have not been manually checked. Changes remain uncommitted.
