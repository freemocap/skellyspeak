# Arabic recording returned English — investigation

Status: observed failure; provider-level cause unresolved. No transcription behavior changed.

## Evidence

Read-only inspection of the active workspace and local server JSONL identified
recording 43f571a3-9129-4160-877c-7e28f475c70c, started September 20 at
23:25:37.575 UTC. The recording was 3.4126875 seconds. Its custom-route receipt
identifies ElevenLabs scribe_v2, HTTP 200, and server request
`e17b0090f6b14b42a3c2ecfca430dc2a`. The provider response reports language_code
`ara` and language_probability 1.0. The resulting saved learner message is English
and its input provenance is speech_transcript. Message/audio content is omitted
from this note.

The resulting turn's captured language context is arabic / arabic-levantine;
external language and transcription tags are both `ar`. Native capture selects
this tag from the conversation target, independently of the explanation language.
Native multipart writes `language`; the server forwards it as `language_code` to
ElevenLabs. The returned transcript passes through server, native and UI without
translation. The conversation graph is invoked after transcription/auto-send.

No working-tree changes were present in the native recording modules, transcription
transport, server audio service/ElevenLabs adapter or UI microphone hook. The
ConversationPage change affects permission to submit a re-recorded edit while
other work is active, not transcript text. Model-routing changes are called only
by conversation execution, not audio transcription.

The receipt records no_verbatim=true. This predates the graph work (introduced
in checkpoint 6fba697) and is documented in
[the earlier transcription note](conversation-length-gloss-transcription-2026-09-19.md).
ElevenLabs documents it as removing fillers, false starts and non-speech sounds;
this does not establish it caused this wrong-language result.

## Limits and verification

The historical receipt does not retain the outgoing language setting or raw
transcript/audio. The captured conversation context and executable request path
establish intended routing, not a packet capture of this individual request.
Provider language metadata does not prove transcript accuracy. No claim about
acoustic input quality or the provider's internal cause can be established from
these retained logs. The exact phrase spoken was requested from the user; the
current UI's Inspect recording can replay its volatile recording if still held.

Existing ElevenLabs adapter tests: 37 passed. These verify request fields and
response preservation using fixtures; they do not demonstrate live recognition
accuracy. No live provider retry, configuration change, server restart, deployment
or commit was performed during this investigation.
