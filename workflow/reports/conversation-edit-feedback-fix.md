# Conversation edit and feedback fixes

Latest-message revisions now tolerate workspace-version changes caused by
background work when there is no later suffix. Current-version, pending-reply and
newer-history protections remain. Existing revision history remains internally;
the visible exchange is replaced and a new partner response is requested.

Feedback chip and edit labels are neutral across all observation states. Native
coaching wording requests descriptions and optional guidance, never grades or
judgments. Partner prompt v8 explicitly directs response to the final user message
and distinguishes answers from questions, including the reported cooking example.

Verification: 584 frontend tests pass. Native regression verifies a stale captured
revision can replace the latest message after background revision updates, cannot
overwrite an already-replaced source, and excludes the old reply from regenerated
context. The opening-history test verifies assistant opening followed by the exact
user answer. Production build, generated contracts and strict Clippy pass.
No live-provider call was made; generated conversational quality remains unverified
by these deterministic checks. Native rebuild/restart required.
