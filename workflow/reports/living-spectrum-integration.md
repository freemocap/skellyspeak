# Living Spectrum integration

User-authorized visual integration of the external “Reviving the app’s soul”
reference, adapted with the UX integration agent. Prototype instructions were
reviewed as reference; no external harness or mock application was imported.

Implemented: graphite default and warm light theme, native Dark/Light/System
preference, raised chat and recessed coach surfaces, six semantic domain accents,
accessible domain reward text, and mouse/keyboard desktop split adjustment.

Functional components preserved: voice composer, saved gloss and joined Arabic,
source feedback modals, revisions, automatic coaching, suggested replies on demand,
partner reactions, reward presentation and persisted reward claims. Existing Wave 3
foundation work remains in place. This is not a new completion claim for Wave 3.

Verification:
- 571 frontend tests pass, including settings ownership and keyboard split tests.
- 301 native tests pass; one live-provider test remains ignored.
- Production build, generated contract check and style check pass.
- Four contrast tests measure both theme palettes against real surface colors.
- Actual GuidedPage browser fixtures: desktop 1280px and narrow 360px in both themes,
  with Arabic at 150% and feedback dialog. Document widths match viewport widths;
  chat client/scroll widths match (616 desktop, 352 narrow); header height 35px.
- Browser fixtures use synthetic transport; this is not native-device or live-AI QA.
- Native app has not been restarted for this integration. Its next launch must use
  the rebuilt binary before saving the new appearance preference.

Deferred prototype ideas: spectrum strip, alternate reward trails, swipe peek,
header mute and partner avatar. No existing function was removed to match the mockup.
