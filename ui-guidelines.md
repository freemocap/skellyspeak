# UI working agreement

User-directed conventions, recorded 2026-09-09. Apply these when changing the UI.

- Reuse the app's existing interaction, vocabulary and components before inventing another control.
- Coach suggestions are always visible in a compact tray above the input. No collapsed preview, Coach toggle, or header spacer. Words keep their tap/hold inspection gestures; a trailing ↗ inserts the reply. Only “Understand the exchange” collapses. Keep tray padding tight and bubbles content-sized.
- Keep the meaning close to the target text. Do not stretch a short suggestion across a row or reserve an empty action column.
- Translation, Pronunciation and Romanization preferences apply to every reading surface, including Coach, lessons and dialogs. Do not invent labels such as “Reading help” for familiar functionality.
- Chat settings live in a gear-controlled top-bar panel, closed by default and separate from Coach.
- Lead with useful content. Explanation is secondary. Do not duplicate the message immediately above the tray.
- Rendering, reopening and changing reading preferences must not request token annotations. Saved annotations reveal meanings locally; unannotated words support explicit word inspection. Coach uses the chat token renderer for pronunciation and romanization, never separate sentence-level sound guides. Draft insertion and preference changes must not request word analysis.
- Reading text and action text have different interaction contracts. Never put word buttons inside a suggestion button. Use the existing word interaction on reading surfaces; do not turn every native-language word in prose into a lookup control.
- Preserve keyboard activation, visible focus and usable touch targets. Compact visual styling does not justify tiny hit targets.
- Inspect the actual mobile view with realistic short and long replies. Check initial useful content, wrapping, scroll, enlarged text, RTL, and request counts. Passing component tests alone is not visual QA.

## References and application

- [Material suggestion chips](https://api.flutter.dev/flutter/material/ActionChip-class.html): compact content-sized suggestion patterns. Our word-inspection requirement uses a trailing insertion icon instead of whole-bubble activation; the user’s interaction contract takes precedence over a generic pattern.
- [Material Web chips](https://material-web.dev/components/chip/): contextual generated suggestions can themselves be interactive input choices.
- [Nielsen Norman Group usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/): consistency, recognition and minimalist presentation. Every extra control competes with the useful text.
- [Progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/): keep the main task immediately available and defer secondary complexity. This does not mean adding a dropdown to every small piece of content.
