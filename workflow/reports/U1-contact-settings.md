# U1 — conversation difficulty and contact profile

Presentation update: the user replaced the slider with a compact dropdown; see [current correction](U1-header-access-correction.md). Slider descriptions below record the earlier reviewed slice, not current UI.

Base revision: 5e006989a2f5d9376952a3cf55f6d713aee6e9f3, shared uncommitted checkout. User-approved bounded implementation relayed through Integration. No Git writes, runtime resets or native launches by U1.

## Implemented

One Difficulty slider beside the language selectors has five discrete labeled stops: Absolute zero, Beginner, Intermediate, Advanced, Fluent. It consumes Reliability’s generated Difficulty contract (absolute_zero/beginner/intermediate/advanced/fluent), with native Beginner default. Pointer release, keyboard release or blur commits the selected setting via updateSettings with the conversation’s settingsRevision. Changes never send/retry/regenerate a reply. Pending writes finish before the next send; save failures remain local and dismissible. Changed settings revisions fail rather than overwrite concurrent changes.

Profile sits beside Lesson/Analysis and shares the existing dark pane and coach dock. Name, conversational tendencies and collapsed background autosave on blur; Vibe selection saves immediately. Existing field bounds and eight-symbol limit apply. The existing avatar is preserved. Profile edits use updatePartner with the displayed contact revision; unsaved drafts are not rebased onto a newer revision silently. Clean editors observe newer saved revisions. Failure preserves draft plus dismissible error and explicit Retry save. No ordinary Save button. Profile writes participate in the next-send barrier; the profile dialog asks the editor to flush and validate its current draft before closing, including Escape before blur. Failed or invalid drafts keep the editor open.

The toolbar Contacts drawer filters existing contacts and their conversations. Selection itself creates nothing. Edit profile and New conversation are explicit actions. The contextual editor and drawer editor use the same component. No new generated-persona/Add to contacts lifecycle, contact deletion or random creation was added.

Removed the inert level/topic/selection localStorage authority and automatic steer-settle hook, plus their obsolete active controls/tests. usePersistentToggle remains as its own small hook. No difficulty compatibility aliases, migration or data rewriting. Assistance remains the same pipeline at every difficulty; there is no special zero-level cue UI.

## Source boundaries

UI owns GuidedPage, useConversationDetails, the explicit send-scope guard in useConversation, DifficultySlider, ContactProfile/ContactChooser, ChatHistory, CoachAnalysisPanel, App Contacts label and owning styles/tests. Two frontend fixtures now use the new enum. Reliability owns generated contracts and native model/defaults; Integration owns prompt and runtime integration. Deprecated unrelated PersonaModal/PersonaSummary are not adopted as the new editor.

## Verification

Style check and frontend build pass. Full frontend suite: 81 files / 383 tests pass after the Code Quality close-path correction. New regressions cover pointer/keyboard slider commitment without mount/hover requests, source revision/avatar preservation, failed draft dismissal, contact selection without creation, updateSettings ownership/concurrency rejection and next-send write barrier. Test count changed because obsolete local steering and topic tests were removed.

Actual-component synthetic fixture at http://127.0.0.1:1423/contacts.html, served from /tmp/skellyspeak-coach-sizing. Explicit fixture/no-inference label. Desktop and 390×844 screenshots inspected. All five labels visible; narrow page scrollWidth=viewport=390. Keyboard End/Home saved Fluent/Absolute zero; Arabic name editing then Tab recorded Profile saved while preserving the exact draft. Fields use existing dark-surface tokens; visible focus remains. Fixture uses local callback stubs, not native/provider execution. No native-device or live-inference verification claimed by U1. Code Quality review requested; Integration owns approved reset/relaunch and combined QA.

## Independent review correction

Code Quality found that pending-write-only close handling lost a focused draft on Escape and could drop a settled failed draft. ContactProfile now exposes an editor-owned flush; ContactProfileDialog waits for validation/save success on every close path. Three integrated tests exercise real DetailDialog/useOverlayLayer: focused Escape waits for saving and reopens saved data; failed save remains open until success; blank-name validation keeps the draft with no command. Final style check/build and 81 files / 383 tests pass. Independent Code Quality re-review closed the P2 blocker; diff whitespace check independently passed. Final style/build/383-test gates were supplied to Code Quality and Integration.
