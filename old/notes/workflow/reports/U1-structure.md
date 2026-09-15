# U1 — bounded frontend decomposition

User authorized structural cleanup beneath the existing reference UI. Extracted two cohesive components without changing stylesheet or markup/classes/control labels:

- ComposerInput owns message-entry form presentation. GuidedPage retains input, recording, request and admission ownership; passes values and explicit action callbacks. No native/provider imports or mount effects in ComposerInput.
- GlossAssistance owns saved-gloss status presentation and local explicit-retry lock/error state, formerly embedded in TurnView. Caller still owns actual request execution. No inference on mount/disclosure/preferences. Existing source rendering remains in TurnView.

Files: new src/components/chat/ComposerInput.tsx and GlossAssistance.tsx; corresponding extraction-only changes in GuidedPage.tsx and TurnView.tsx. No CSS changes or dependencies. Earlier uncommitted changes in those parent files are preserved.

Verification: build passed, all 75 frontend test files / 354 tests passed, including existing composer rejection/draft/recording behavior and duplicate retry suppression/passive word reading checks. Stylesheet output hash remains index-DNLTubIc.css, unchanged from preceding compact presentation build. No separate native visual claim for this extraction.

Integration's request to freeze frontend for repaired-app QA arrived immediately after extraction was written. Integration notified of exact files and passing results; source frozen with extraction present pending its snapshot. No Git writes, native launch, request/controller changes or further refactoring during QA.
