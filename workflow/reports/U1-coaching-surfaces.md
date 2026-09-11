# U1 — coaching surfaces proposal

Proposal only. No UI, schema, provider or scheduling implementation. The waveform slice remains frozen. User direction: automatic per-turn correctness and understandability assessments, source-linked skill evidence and reply suggestions; deeper analysis on demand; saved inspection reuses accepted results. Six domains are the approved target, with Language owning their definitions/mapping.

## Reference and current-source review

Read deprecated reference source, without running it: old/skellyspeak-app/src/components/chat/TurnView.tsx, MessageFeedback.tsx, panes/CoachEntry.tsx, ComposerHelp.tsx and AnalysisContent.tsx. Reference learner bubbles use a compact feedback badge; the contact bubble’s action is actually labeled Analysis. Feedback disclosure shows source text, scores, explanation and corrections. Green suggested-reply cards sit above the composer with a separate insertion arrow, optional saved translation and collapsed Understand the exchange. These are presentation patterns, not accepted old data contracts.

Current counterparts and styles remain in src/components/chat/MessageFeedback.tsx, TurnView.tsx, panes/ComposerHelp.tsx, CoachEntry.tsx, AnalysisContent.tsx and styles.css. The current native snapshot projection in lib/conversation-view.ts supplies empty coaching scaffolds and no automatic feedback artifact; component availability does not mean automatic coaching is implemented. Existing private submitted coach chat is a separate feature.

## Compact mapping

| Existing surface | Proposed content/interaction | Saved inspection versus requested work |
| --- | --- | --- |
| Learner bubble feedback badge | One compact entry for Correctness and Understandability when assessed; compact pending/failed/insufficient-evidence state otherwise. Exact score scale awaits rubrics. | Opens the accepted automatic feedback for that message; never requests inference. |
| Existing feedback disclosure / Analysis pane | Source message, distinct two assessments, short explanation and source-bound corrections; compact evidence rows with source excerpt and accepted skill label. Reuse current disclosure/Analysis layout, no new full-page modal. | Selecting a source or skill reveals saved evidence. Existing Analysis opens saved details even when deeper analysis is absent. |
| Existing green composer tray | Saved suggested replies for the current exchange, with existing insertion arrow, reading preferences and optional saved translations. Keep only Understand the exchange collapsed. | Text inspection/reveal is read-only; insertion appends to draft, records known assistance and focuses composer. Send remains separate. |
| Existing Analysis detail actions | A small Analyze further action, alongside existing actions, clearly distinct from opening Analysis. Show active/failed state at this source. | Explicit action requests deeper analysis for this source. Reopening accepted deeper details reuses them; no implicit regeneration. |
| Existing Talk to your coach dock | Private follow-up draft with source context selected from feedback. | Ask the coach inserts a draft; its explicit Send initiates the private request. Opening the dock does not. |

Preserve the current navy shell, paper messages, blue feedback action, muted green reply tray, typography, compact padding and composer’s prominent Record/Stop/Send. No new dashboard, score ribbon, large coaching header, sidebar navigation category or full-page modal. Avoid duplicating all feedback in both the bubble and pane. Desktop uses the existing nearby Analysis surface; narrow layout uses existing disclosure/navigation and keeps the composer available.

## State and source rules

Automatic analysis starts from native turn lifecycle, not component mounts or effects. The UI observes two independently saved automatic results: learner-message feedback and contact-reply-dependent help. Deeper analysis remains a separate source-owned artifact. Reply text, translation, glosses, speech and the next learner turn remain usable while coaching is pending or fails. Learner-message feedback starts immediately from the saved learner source, independently of contact generation. Suggested replies and reply-dependent help start when the contact’s text arrives, alongside speech/gloss/translation. Neither node waits for the whole turn or needs another user action. Integration/Reliability own execution contracts.

Pending uses existing compact ActivityIndicator at the affected surface only when authoritative state is active. Missing/unrequested saved details are not an endless spinner. Failure uses dismissible local ErrorDetails with source identity. Any Retry is explicit and only exposed if the accepted native contract supports it. Dismissing an error cannot alter durable operation state or retry. An unavailable/insufficient assessment is not zero, and accepted available fields remain visible when the contract explicitly represents insufficiency or partial coverage. Each accepted result remains atomic internally; the two automatic results hydrate their existing surfaces independently.

A selected old message shows its own saved feedback. Late suggestions for an older exchange must not replace the current composer tray; they remain available through that exchange’s inspection. Source mismatch/stale status must be explicit. Profile/difficulty changes or reading-preference changes do not regenerate accepted feedback; old results retain captured provenance. No optimistic fabricated feedback, inferred scores, synthetic learner statistics or automatic reward issuance.

## Evidence and six domains

Correctness and contextual understandability are separate model estimates. Do not relabel the reference Grammar/Conversation /5 outputs as the approved new rubrics. Do not render arbitrary five-point dots until the scale is accepted. Evidence retains exact message/range identity, observed feature, uncertainty/insufficiency and known composing assistance separately from derived XP or longitudinal proficiency.

Language owns the proposed six-domain names, mapping and overlap policy. Do not expose a second local taxonomy, six empty progress gauges or rename the existing seven-domain catalog prematurely. Compact rows should render accepted skill/domain labels from data, link to the source and reuse existing skill inspection. Assistance-derived use must remain distinguishable from independent learner production. Contact reactions, authored Vibe and private coach assessments stay distinct; none is a measured proficiency score.

## Acceptance for a later authorized slice

- Mount, reopen, hover, word reveal, preference change and saved-feedback inspection trigger zero inference callbacks.
- One Analyze further activation requests only its source; repeat activation while active cannot duplicate work. Saved deeper results reopen without a request.
- Automatic feedback/suggestions arrive without blocking typing, recording, speech or another send; stale results remain attached to the original source.
- Green reply insertion changes only the draft, preserves exact text and marks assistance; it never sends. Keyboard and touch have equivalent controls.
- Failure remains dismissible and local; pending/partial/insufficient states are distinct, with no invented scores or retry APIs.
- Review actual full conversation at desktop/narrow widths, reading scale and RTL, retaining current header/composer density. Show authored fixtures explicitly until production contracts are accepted.

## Coordination and unresolved contract points

Language and AI Operations were asked directly for six-domain mapping, assessment/evidence boundaries, artifact timing and saved-versus-requested work. Their proposals remain authoritative within their ownership, subject to Integration review. Needed before UI implementation: accepted rubrics/nullable outcomes; source identity/range policy; independent artifact/state ownership; automatic scheduling and stale suggestion policy; explicit deeper-analysis/retry action; assistance provenance and skill mapping. No production type is invented here.

### Automatic scheduling — current user decision

Learner-message correctness/understandability feedback, source-linked evidence and learner-source corrections can arrive on the learner bubble before a contact reply. Green next-reply suggestions and contact-dependent explanations populate the composer tray after contact text is available. Feedback completion/failure does not gate reply help, and reply-help completion/failure does not gate feedback. Neither gates composing, recording, speech or the next learner turn.

Use the existing compact feedback pending indicator and green-tray pending indicator only for their own authoritative active node. Do not add verbose whole-turn status text, another coaching header, or buttons to start these automatic nodes. Contact failure cannot prevent the learner feedback node from completing; without contact text there is no suggestion request and no suggestion spinner. Native terminal/absent-state mapping must preserve that boundary. Inspection of either saved result makes zero calls; deeper analysis is still explicit. Old help stays source-linked and cannot overwrite the current tray/draft.

### Language coordination received

Read the current superseding section of [L1 coaching contract](L1-coaching-contract.md) and [six-domain proposal](L1-six-skill-domains.md). Language recommends retaining all21 observable subskills while merging Time and Space into Time, place & movement. Proposed six display groups: Entities & reference; Properties & comparison; Events & participants; Time, place & movement; Negation, questions & possibility; Connecting ideas. This mapping is proposed, not an adopted catalog change. UI evidence rows use native skill-to-domain mapping and only observed criteria; no six required judgments or credit propagation to unobserved children.

Language proposes categorical correctness and understandability outcomes rather than numeric scores, including explicit insufficient evidence. Surface copy can therefore display short outcomes such as “Issues found” and “Likely clear” separately, with rationale/source evidence in the existing disclosure. Those labels/rubrics await contract review; no legacy /5 field is reused. Corrected/generated wording is assistance, never learner evidence. ASR text alone cannot establish pronunciation/listening performance.

Learner feedback starts immediately and completes independently even if contact generation subsequently fails. Suggestions are requested only when contact text exists; otherwise no suggestion request is made. Integration still defines node identities and absent/failed help states. Language separates context used to predict understandability from the newly generated contact reply used for next-response help; a cooperative generated reply is not proof of comprehension.

UI implementation remains unassigned. This handoff adopts no schema, rubric, domain IDs, migration, reward rules or provider work.
