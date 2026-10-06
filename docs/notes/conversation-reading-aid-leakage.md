# Reading aids inside conversation text

2026-10-06: implemented prompt correction; automated verification passed.

The reported Cantonese message showed a bracketed Jyutping copy in the same text
as the partner's sentence. The message view renders `assistant.reply` as source
text and passes reading segments separately; it does not construct this bracketed
suffix. The shared conversation prompt already prohibited romanization. No live
request/response receipt was inspected, so model instruction noncompliance is the
likely explanation, not a verified diagnosis of that exact request.

The shared base prompt now explains that reading assistance is supplied separately,
forbids appended/interleaved pronunciation copies even at beginner level, and tells
the partner not to imitate such annotations from earlier messages. Legitimate
names, quotations, punctuation and the requested writing system remain allowed.
Prompt version 41 identifies this change. Regression coverage exercises all offered
varieties, opening/reply modes and three difficulty levels.

This is a prompt mitigation, not a deterministic guarantee. No language-specific
filter or destructive bracket removal was added. Existing saved messages remain
unchanged. The separate proposal to simplify partner-name display is not implemented
by this change. The observed development executable was rebuilt at 08:00:56 local
time and restarted at 08:00:58, after the prompt edit at 08:00:11. This confirms a
fresh development process, not a live model-compliance test or installed release.

Fast validation, Clippy with warnings denied, authored-content validation and
documentation-link checks passed. The full native library suite passed: 833 tests,
five existing live/experiment tests ignored, no failures. No live inference was
performed for this correction. Changes remain uncommitted.
