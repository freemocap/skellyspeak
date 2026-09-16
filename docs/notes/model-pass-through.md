# Model pass-through audit — September 15, 2026

## User decision

Configured model IDs should reach OpenRouter or Groq; providers determine model
availability. This change does not replace authentication, request contracts,
limits, spending controls, or the existing choice of provider for each route.

## Implemented

- Removed native hosted text-model allowlists, speech model equality checks, and
  Custom URL checks against advertised text/transcription model lists.
- Removed the chat endpoint's rejection of GPT-OSS and the Groq adapter's
  model-name rejection. Grouped GPT-OSS requests still use Groq; other grouped
  text requests and the chat endpoint use OpenRouter.
- Transcription accepts structurally valid model identifiers and forwards them
  unchanged to Groq. Audio output contracts depend on requested output fields,
  not model names. Grouped requests continue to require text output.
- Removed the Gemini-specific Google AI Studio endpoint pin. OpenRouter price
  ceilings and required-parameter routing remain in place.
- Provider errors retain their provider/status classification, with no automatic
  retry and without exposing raw provider bodies.

## Verification

Server: 289 passed, seven Firestore emulator tests skipped. Native AI tests:
63 passed, using local mock HTTP servers. Tests cover unfamiliar model IDs,
provider rejection, no retry, and preserved output contracts.

## Limitations and unresolved issue

The user's screenshot already reports an upstream OpenRouter HTTP 400. It does
not establish a local model-name rejection, and its exact upstream cause has not
been determined. These changes do not guarantee that request will succeed.

Transcription accounting still uses the existing duration-based service allowance
estimate, not model-specific Groq price discovery. OpenRouter's price ceilings
can still cause provider rejection. No real-provider inference, deployment,
server restart, or native app rebuild was performed in this audit.
