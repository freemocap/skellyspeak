# Conversation difficulty correction — 2026-09-12

User requested substantially simpler Absolute zero and Beginner replies after
observing complex, extended responses on the phone.

Implemented in `src-tauri/src/conversation_prompt.rs`: contract v5 makes selected
difficulty the ceiling over profile manner/detail, novelty, conversational hooks
and prior reply complexity. Absolute zero requests one tiny utterance, one clause,
normally 2–5 words and at most 7. Beginner defaults to one simple sentence, at most
two sentences and 12 words total. Other writing systems use equivalent brevity.
Both levels restrict vocabulary and syntax, with short examples. Grammar is
preserved by simplifying the idea. Removed conflicting obligations to elaborate
on the partner's life and append a hook to every answer. DESIGN.md records this
decision. No additional inference or automatic retry was introduced.

Verification: all 229 native library tests pass, including difficulty selection,
profile projection and captured-settings coverage. Formatting, Clippy with warnings
denied and diff whitespace checks pass. The initial sandboxed suite passed 217
tests and failed 12 localhost HTTP tests on socket permission; the complete rerun
with localhost permission passed. These tests verify source behavior and prompt
capture, not live model compliance.

Phone inspection completed after the user explicitly authorized the private local
copy. The SQLite copy passed integrity_check. Inspected all 105 frontend diagnostic
events and the single native initialization event from the only listed phone log
run, plus both saved partner exchanges and their captured system prompts/settings.
The logs cover startup, successful sign-in and microphone autosends; captured turn
records provide the decisive difficulty evidence. No hosted server logs were read.

At 2026-09-12T22:18:51.225Z, a Beginner reply contained 25 whitespace-separated
Spanish words across a greeting, wellbeing response, profile-derived situation and
follow-up question. At 22:19:26.595Z, Absolute zero produced 13 words across two
sentences, again adding the profile-derived situation. Both requests captured the
correct selected difficulty and contract v4 instructions. This confirms excessive
output despite correct difficulty capture in these two cases. Both replies draw
on the profile's current situation; the mandatory life/hook instructions are a
plausible contributor, not an isolated causal finding. The v5 change directly
removes those obligations at low difficulty. Raw transcripts remain only in the
private temporary inspection copy, outside the repository. Phone data was unchanged.

Remaining: live provider/device verification of short replies, including an
existing complex conversation and a detailed persona. Prompt constraints do not
guarantee semantic compliance. The user subsequently authorized phone installation. The ARM64 debug APK built
successfully, and inspection of its packaged native library confirmed all v5
difficulty markers. ADB installed it in place and brought the app to the foreground;
the installed package update time is 2026-09-12 18:28:39 device local time. A
read-only database comparison confirmed all four previously inspected messages
were preserved. No live inference was submitted. No Git writes or public release
was performed. The build emitted existing frontend-size and Android/Gradle
deprecation warnings.

## Beginner calibration — contract v6

User verified Absolute zero is good and Intermediate feels right, but reported
Beginner became too terse and left no conversational opening. Retained both those
level instructions. Beginner now usually requests two natural sentences, 12–24
words with a ceiling of 28, and a concrete detail or easy question. Common tense
forms and simple connections are allowed. Bare acknowledgements and disconnected
fragments are discouraged. The shared exception allowing an answer alone now
explicitly applies to Absolute zero, so it cannot cancel Beginner's opening.

Formatting, all three prompt projection tests, Clippy and Android APK build pass.
Verified v6 and the revised word ceiling inside the packaged ARM64 library. ADB
in-place installation succeeded and the app was opened. No app-data reset or live
inference was performed. Actual conversational calibration remains user QA.

## Two reply suggestions

User requested two items in the suggestions box. Generation now requests exactly
two, the schema and native validator allow at most two, and the tray displays only
the first two saved items with a matching collapsed count. Existing saved results
are not rewritten. One valid suggestion remains accepted by the existing validator.
All 420 frontend tests, five focused native coaching tests, formatting, styles,
whitespace checks and Android build pass. Installed the APK in place successfully
and opened the app. Desktop/narrow visual inspection and live generation were not
performed in this pass.

## Chat header spacing

Removed the visible Learning label while retaining the target selector's accessible
name. The three selectors now share a single grid row in proportions 1:1.15:1.4
(language:difficulty:partner), with consistent rounding, typography and padding.
The partner fills its allocated width; long labels truncate within their controls.
The saving announcement is visually hidden so it cannot create a fourth grid cell.
Updated UI-SURFACES.md. All 486 frontend tests and style checks passed; Android
build succeeded after the concurrent audit task fixed its startup call-site error.
Installed in place successfully. Automatic approval review rejected copying a full
phone screenshot because it could expose private conversation content; screenshot
inspection was not performed. Desktop and phone visual QA remain unverified.
