# Word speech — proposal only

Reuse the saved source word/phrase and existing speaker styling. Reveal a small speaker action on hover and focus-within; touch can reveal it with the existing word/gloss interaction. The speaker is a separate sibling button, never nested inside the word button. Accessible name: Speak followed by the exact source text. Enter/Space on that button is an explicit speech intent. Hover, focus, gloss reveal and reopening never request speech.

A future explicit request must bind native message identity, saved source range and language, preserving Arabic letters and combining marks. Existing whole-message requestMessageSpeech is insufficient: Integration/native owners must review a span contract before implementation. No speculative IPC or audio code was added. Native ownership includes duplicate suppression, cache policy, cancellation on recording/navigation/new turn and stale-result rejection. No provider fallback or automatic word precomputation.

Acceptance for that future slice: exact source/diacritics; zero requests from hover/focus/render; one deliberate request; keyboard/touch access; cancellation and stale-source rejection. Product and contract review remain pending.
