# Eight-group learning, contextual coaching and complete language source guides

Learners can inspect eight communication skills, read language-specific explanations
and examples, ask the coach about a selected section, and start conversations aimed
at a skill or containing an exact selected phrase. Conversation and coach remain
the central workspace, with Practice and Skills as secondary destinations.

The native assessment pipeline sends one Jev request containing eight skill
questions plus grammar and understandability. Correct group use earns XP;
subskills organize teaching material without separate XP. Coaching automatically
marks message errors, partner replies use Fast, and optional analysis/reading work
supports shared Automatic/On demand controls.

Required source content is complete for all 20 target languages. English source
guides carry explicit AI authorship and review status; Spanish/Arabic explanation
editions can be translated on opening and cached. Missing required source content
is an error. CI checks required coverage and generated schema freshness. Native
workspace migrations preserve durable history and earned awards.

## Validation

- 1,779 UI tests; TypeScript and production build.
- 822 native library tests passed, 5 ignored; configuration regression tests and
  Clippy with warnings denied passed.
- 577 server tests passed, 7 Firestore-emulator tests skipped.
- Generated contracts, content readiness/schemas, content workbench, benchmark
  fixtures and documentation tests passed.

## Review limits

AI-authored language material awaits independent linguistic review. Optional
bundled translations and systematic model-quality experiments are follow-ups.
Final running-app acceptance is tracked in `pr-readiness.md`; do not mark it
complete until exercised. Hosted CI and cross-platform builds remain unverified.
