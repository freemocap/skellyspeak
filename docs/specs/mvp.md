# Spec: MVP (chat-first conversation partner)

## Purpose
A push-to-talk cross-language conversation partner: speak (in mixed languages), see a
word-aligned bilingual transcript, get a mixed-language tutor reply.

## User flow
1. Configure a language pair (shared + target).
2. Hold PTT key, speak, release.
3. See live transcript with the current word highlighted + matched to the target language.
4. See an LLM tutor reply (mixed shared/target language, grammar/vocab help).

## Acceptance criteria
- [ ] Hold key → release produces one transcription turn (no missed/cut speech).
- [ ] Transcript shows word-level timing + word alignment.
- [ ] Tutor reply renders as a chat bubble.
- [ ] Works fully offline except the LLM provider.

## Out of scope (MVP)
TTS, video mode, multi-target languages at once, speaker diarization.
