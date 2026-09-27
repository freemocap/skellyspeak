# Speech playback highlighting

Implemented in source, September 2026. No deployment or commit performed.

## Behavior

- Word transitions slide and resize over the shared 120 ms fast duration with
  the existing ease-out curve. Timing gaps and stop fade out; invisible geometry
  remains mounted for the next transition and is removed on unmount or source
  changes. Scroll/resize reposition immediately, and reduced motion disables
  transitions. The source-only geometry and common rendering path are unchanged.
- The borderless fill uses 24% of the existing theme-aware interaction ink. Light
  and dark modes inherit their existing blue values through the shared reading
  stylesheet; no per-surface colors or theme settings were added. The preview
  includes a light/dark selector for inspection.
- Shared target-text renderers measure source-only DOM ranges and draw translucent
  rectangles over the currently spoken word. They retain word-help controls and
  original text; glosses, romanization and translations are not highlighted.
- The shared audio player uses its media clock, including rate changes and seeks.
  It publishes word changes rather than rerendering reading surfaces every frame.
- Chat replies, shared sentence and token read-aloud, fetched and retained Drill
  references, and audible reference scrubbing use this machinery. Existing
  transcription-inspection tracks retain their own recording-timeline highlight.
  Learner recordings are not projected onto the target phrase: their transcript
  may differ from it.
- Retained character alignment maps through shared Unicode word boundaries.
  When source mapping or timing is unavailable, visual pacing is estimated from
  audio duration and grapheme counts, as requested. No extra network requests,
  saved evidence, matching normalization or assessment changes are involved.
- Token read-aloud retains its selected source offset, including repeated words.
  Identical visible source passages can follow the same playback. Ambiguous
  excerpts are left alone rather than choosing a different occurrence.
- Stop, interruption, errors and component unmount clear highlights. Overlays
  follow scroll/resize, respect clipping, and mount in their dialog/popover layer.

## Verification

Production UI build, style checks and preview type-check passed; 307 tests across
46 focused suites passed. Focused automated
coverage includes Unicode anchors, repeated words, timing gaps, estimated pacing,
source-only rendering, dialog ownership, media clock, seeking, speed, cancellation,
audio-result forwarding and retained reference playback. The build reports its
existing large-bundle advisory; Drill DOM tests report unavailable canvas rendering.
Regenerating the design-system CSS also refreshed previously stale sections from
existing application styles; those source styles were not changed by this work.

The browser-control inventory is empty in this session, so actual visual review
and live spoken-audio synchronization remain unverified. The local fixture at
`/tools/speech-follow-preview.html` uses the production player and a silent
12-second WAV; it is ready for that inspection and makes no service requests.
