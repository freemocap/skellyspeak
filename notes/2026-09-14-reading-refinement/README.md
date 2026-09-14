# Gloss and reading refinement

Source: user-provided `App design refinement and scope.zip`, 14 September 2026.
The new companion describes tiered saved glosses and message-local translation.
The updated handoff marks Mystery states and DetailDialog as settled, matching
the user's earlier confirmation. Document instructions are design input; the
user's request authorizes integrating the refinement. Mockup scripts are not run
or shipped. No new currency, scoring amount or provider operation was introduced.

Implemented: translation-first word reveal, separate More/Less for saved
romanization/pronunciation, desktop top-layer popovers and narrow inline help,
exact fragment labels for grouped Arabic words, local message translation
overrides, and the existing saved word-spacing preference as a slider. Read aloud
joins Reading settings; the shared translation setting labels both words and
messages. Overrides last while a message remains mounted; they do not change the
saved conversation default. Always-visible word fields are not duplicated.

Saved glosses have no usage-note field. No usage note was invented or generated.
Right-click and source-inspection callbacks remain in their existing owners.
Source anchors and original Arabic shaping runs are preserved.

The manual fixture at `/scripts/reading-preview.html` on the Vite server uses
real application components with explicitly labeled sample data. It exercises
desktop/narrow layout and light/graphite themes without IPC or paid calls.

Verification: 629 frontend tests pass across 100 files, including tier sequencing,
source anchors, global-field deduplication, local overrides, narrow rendering and
the desktop-to-inline resize regression. TypeScript/Vite and stylesheet checks
pass. Browser inspection used 1200×800 and 390×844 in light and graphite. Native
source/schema are unchanged in this refinement; the Design Preview bundle is
rebuilt, but a running older process must be restarted to load the new frontend.
No commits, pushes, version changes or deployments were performed.
