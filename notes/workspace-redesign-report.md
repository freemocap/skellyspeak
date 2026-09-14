# Workspace redesign — 14 September 2026

## Implemented source

Practice/Learn/Review share top-level navigation. Practice has a desktop partner
rail with language labels, a conversation sheet and Coaching/Evidence study tabs.
Mystery partners add Persona. The coach input stays in the study pane; its former
dock and secondary resizer are removed. PracticeDivider retains its existing drag,
keyboard and reset behavior. Corrections sit below learner messages and select
Coaching for the source turn. Inline message XP is moved into study evidence.

Learn embeds the existing lesson workflow, with creation and saved lessons in its
rail and Objective/Examples/Exercise/Quiz/Practice navigation. Moving between steps
preserves answers. The native generation, exposure, quiz and practice actions remain
in use. Empty conversations keep the composer usable, with one-tap partner opening,
an optional topic and a lesson entry.

Review adds a tree derived from distinct credited attempts per domain; empty domains
have dashed branches and an explicit insufficient-evidence label. It reuses the same
component for language progress. Existing detailed evidence inspection remains.
Rewards lists saved skill awards and separate quiz/Mystery credits. For native skill
awards it shows captured support, difficulty, novelty and policy hash. It does not
recompute historical multipliers from current configuration or invent missing dates.

The palette uses sheet/well surfaces, six named type roles, interaction ink and
separate correction/error semantics. IBM Plex Sans, IBM Plex Mono and Newsreader
fonts are bundled for offline use with their licenses. Settings and dialogs share
surface rules; related existing controls retain their ownership and behavior.

## Confirmed decisions and implementation choices

The user confirmed the three-state Mystery model and DetailDialog for guesses,
plus optional Warm/Curious/Blunt/Playful/Formal chips that extend free-form Manner.

Mystery discoveries are partner-owned and persist across conversations. Correct
answers earn 1 XP once per field, matching the existing lesson recall quiz amount.
The illustrative +3 XP in the 5pm design is not a new scoring rule. A separate Reveal
changes visibility without paying again. Wrong guesses have no penalty and may be
retried. A nudge appears after eight learner messages; dismissal belongs to the
conversation. Revealed/guessed facts cannot be edited into different facts, including
by switching to Standard; create another partner for another identity. Switching
type does not clear awards. Deleting a source conversation leaves the partner's
award intact; deleting the partner deletes its discovery records.

The backend validates ownership, persona revision, nonempty fields and repeated
actions. Guess XP contributes to totals, never skill proficiency. Correct guesses
use existing reward sound settings, with separate confirmation/reveal motion and
reduced-motion support. The profile's full facts remain in local workspace data;
Mystery is presentation concealment, not a security boundary.

Schema 16 adds partner-field discoveries and per-conversation nudge dismissal.
Development follows the existing explicit-reset policy, with no migration. No
existing user data was erased during this task. The inspection build uses a separate
identifier, `com.freemocap.skellyspeak.design-preview`, and its own workspace.

## Verification

- Full frontend suite: 624 passed across 100 files.
- Native suite: 345 passed, 1 ignored. Local HTTP tests required running outside
  the sandbox after loopback listeners were denied there.
- TypeScript/Vite build, contract generation/check, Rust formatting, strict Clippy,
  language parity and stylesheet checks performed. Vite retains its large-chunk
  advisory; this is not a failed build.
- Browser inspection: actual Review demo at 1440×960 and 390×844, including empty
  evidence states, rail/main/study placement and bottom navigation. Demo data is
  explicitly labeled and is not evidence of a working native exchange.
- A local unsigned macOS Design Preview bundle was built and opened; its separate
  workspace database and configuration were created. Native UI was not inspected
  through automation (native computer control is unavailable). It is not
  a release, deployment or signed-keychain verification.

## Remaining work and checks

- Native user inspection of Practice, Learn, Settings, graphite, RTL/enlarged text,
  live generation and speech remains separate from automated checks. Browser-only
  rendering cannot verify Tauri storage, AI routes, microphone or keychain access.
- Recording inspection retains the existing real waveform/spectrogram/timing data.
  The new log-Mel feature stage is not implemented; no illustrative plot substitutes
  for measured signal data. Its exact signal-processing contract needs a focused pass.
- The 5pm design's dedicated rewards-history export and historical multiplier
  breakdown are not implemented. Current awards expose their saved metadata;
  original numeric multipliers would need a persisted historical projection.
- Mystery distractors prefer other same-language partners, then a small translated
  vocabulary. They are deterministic choices, not generated plausible biographies;
  language-specific distractor quality needs review.
- Voice and difficulty remain conversation settings; language remains the partner's
  existing identity. The mockup's three persona selects do not override that ownership.
  Surprise me reuses the existing validated generation and avatar recipes.
- Newsreader italic is currently synthesized by the browser; an offline italic
  font asset is not yet bundled.
- The branching tree uses evidence counts and presentation thresholds 1/6/12.
  It is not a proficiency estimate; richer filters and reward animation tuning
  remain focused follow-ups.

## Reference provenance

The 3pm handoff is at `2026-09-14-3pm-design_handoff_workspace_redesign/`.
The 5pm ZIP repeats that handoff unchanged but adds sections 19–23 in its top-level
HTML, preserved in `2026-09-14-5pm-design-guidance/`. Those sections informed the
reward ledger, shared language tree and separate guess/reveal presentation. Supplied
instructions are design input, not authority to replace user decisions or the active
coaching contracts. Research claims in the mockup were not independently revalidated
or introduced as new scientific conclusions in this pass.

No commits, version changes, pushes, release tags or deployments were performed.
