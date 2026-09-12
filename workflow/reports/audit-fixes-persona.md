# Persona audit fixes — 2026-09-12

Implemented A08, A09 and A11.

- Persona list text updates the parent-owned parsed draft on every edit, while preserving in-progress text formatting locally. Escape can validate/save focused lists without relying on blur.
- Close button, backdrop, native cancel, Escape and New persona use the same flush policy. A persisted-record ref prevents a rapid blur/close from writing the same edit twice before React renders the save result.
- Discard unsaved changes explicitly restores the last saved persona (or a newer supplied revision), clears failed input/error state and remounts list buffers. It works after Clear, invalid input and rejected saves. Pointer activation avoids blur-triggered autosave; moving focus directly to Discard also suppresses that blur commit.
- Native/frontend emoji validation now uses equivalent explicit sequence rules for eligible bases, selectors, modifiers, two-indicator flags, keycaps, tag flags and joined pictographs. Both run the same 49 adversarial fixtures. Invalid bases with selectors, dangling indicators/joiners, arbitrary combining marks and ineligible modifier bases are rejected. This recognizes sequence structure rather than restricting authored emoji to an RGI allowlist.

Verification: 76 focused frontend tests passed across PersonaProfile, PersonaProfileDialog, NewPersonaDialog and personaLimits; TypeScript check passed after all changes. Four native emoji tests passed, including shared fixtures. Exit-path tests cover focused lists with all five exits, invalid lists, Clear recovery, failed-save discard and discard without saving. No real native UI inspection was performed; no CSS was changed. No Git writes or paid inference occurred.
