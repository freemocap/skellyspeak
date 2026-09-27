Shared playback highlighting for target text, composed by `SavedGlossText` and
`UnannotatedText`. Callers keep using the existing reading components.

The active word receives a translucent, noninteractive rectangle using
24% `--interaction-ink` mixed with transparency and `--radius-xs`, with no outline.
The existing interaction token supplies a deeper blue in light mode and a lighter
blue in dark mode; the shared component rule follows both palettes automatically.
Measured source ranges
preserve text shaping, wrapping and word help. Reading aids are excluded.
Rectangles follow scroll and resize, clip to scroll containers, and remain inside
the owning dialog or popover layer. Nested reading renderers share one overlay.
Word changes slide and resize over `--dur-fast` (120 ms) with `--ease-out`.
Timing gaps and stop fade the overlay out; invisible geometry remains available
for the next word. Scroll and resize reposition immediately. Reduced-motion
preferences disable all highlight transitions.

The shared audio player supplies word transitions from retained timestamps or,
when those cannot map to source text, estimated pacing over the audio duration.
This is a visual aid, never pronunciation or learning evidence. Highlighting
clears when playback ends, fails or is interrupted. Audible reference scrubbing
uses the same timing machinery in either direction.

The static preview shows resting text. For a real media-clock exercise, run the
UI development server and open `/tools/speech-follow-preview.html`. Its silent
local sample covers supplied timing, estimated timing, speed changes, seeking,
reading aids, mixed scripts and dialogs without a service request.
