# U1 — Read-only CSS reconciliation audit

Status: baseline audit retained for traceability. Cleanup was authorized after the combined checkpoint and is now implemented; see [results and limitations](U1-css-results.md). No Git mutations or second native launch.

Audited src/styles.css SHA-256: a261ac3efb9927cbbdb29adff950f88d03cc39800cc5e3395fdc7e295142d2c7. The strict checker reports 71 failures: 64 repeated occurrences across 60 selector/scope groups, one repeated property and six important declarations. These are inherited rules, not 71 independent appearance defects. Checker keys exact selector strings and literal at-rule parameters; equivalent media spellings and overlapping selector groups are not detected.

## Finite implementation batches after checkpoint

1. Capture a fixed baseline of current component DOM, computed styles and screenshots before edits. Keep source, browser build, fonts, fixture data and viewport identical during comparison. Use the running native app for available surfaces without sending messages; never enable old inference-bearing graph controllers merely for CSS review.
2. Consolidate repeated base rules by component: chat/reading/header/composer/scaffolds; settings/persona/coach; graph/activity; progress/map. For each group inspect intervening matching selectors, pseudo states, shorthands and media rules before selecting its owning location. Preserve winning longhand values and rule-order relationships. Do not mechanically move every declaration to the first or last rule: that can change equal-specificity overrides. Do not alter selector spelling to evade the checker. Retain functionality-deferred component CSS unless a separate consumer audit proves it unused.
3. Consolidate repeated responsive rules within equivalent media conditions, preserving interactions with base rules and narrower breakpoints. Treat max-width:860px and max-width: 860px as equivalent for the audit even though the checker distinguishes their strings. Remove the earlier line-height:1 in .scaffold-toggle (244), retaining its current winning 1.1 (245); verify the 44px minimum width/26px minimum height and text baseline.
4. Resolve the six important declarations through actual ownership changes described below. This requires two small presentational inline-style changes in graph components after checkpoint; do not silently broaden to graph data/controller work. Preserve reduced-motion suppression for component and third-party rules.
5. Run the unchanged strict checker, TypeScript/build and relevant presentation tests. Compare the same baseline states after every batch. Full frontend suite once after final changes; no native/provider inference for this cleanup. Record unsupported native surfaces separately from fixture-rendered CSS checks.

## Important declarations and concrete owner decisions

| Location | Owner problem | Proposed resolution requiring verification |
| --- | --- | --- |
| 902 .gpanes:not(.maximized), <=1100px | AgentGraph.tsx:214 writes gridTemplateColumns inline, forcing mobile CSS to override it | Pass split geometry as a CSS custom property; base grid rule consumes it, <=1100px owns one-column geometry. Preserve maximized behavior and existing resize range. |
| 908 .graph-inspector, <=860px | NodeInspector.tsx:29 writes width inline | Pass inspector width through a CSS custom property; base rule consumes it and narrow rule owns width:100%. Preserve flex basis, borders and resize behavior. |
| 1590 .graph-explore .graph-inspector, <=860px | Same width ownership plus absolute inset overlay and later padding override at1597 | Resolve together with908; consolidate narrow explore rule retaining inset, z-index, background and final padding-top:52px. |
| 1216 .mobile-hidden | Utility suppresses all displays using important | No consumer found in current src outside stylesheet. Repeat static and dynamic class-construction search after checkpoint; remove only if still unused. If needed, give the actual owning surfaces explicit hidden-state rules rather than a universal override. |
| 1272 universal transition:none | Universal reduced-motion rule currently wins over all component transitions | Inventory matching animated/transitioned selectors including hover/focus and vendor CSS, and place reduced-motion overrides with appropriate component ownership/specificity. Preserve computed zero durations. |
| 1272 universal animation:none | Same, including animations introduced later in file | Preserve animation-name:none in all tested states and pseudo-elements; do not replace with a finite duration that leaves motion or timers active. |

## Exact verification matrix

Baseline views: chat with saved source and translation, voice-first composer idle, focused input, open conversation settings/scaffolds, partner chooser, coach pane and disclosure, settings navigation/search/expanded model details/error/disabled controls, AI dock frame at two heights, narrow Chat and Lesson surfaces. Reading samples: LTR and Arabic RTL, long word/phrase, long partner name, multiline source; static test data explicitly labeled fixtures. Deferred graph inspector/split/map/XP states use their existing presentational components or markup fixtures with no native/inference effects; do not present them as working product features.

Primary screenshots at1280x900 and390x844; threshold probes at widths379/380/381,479/480/481,599/600/601,619/620/621,859/860/861,1099/1100/1101. Height probes549/550/551 at width860 cover landscape query. Default reading100%/2px and enlarged150%/6px; both normal and reduced motion. Fine and coarse pointer states where the runner supports them. Start with the two primary views plus860 boundary for each edit batch, then run the complete matrix once. Native screenshots at matching available window sizes establish actual application appearance; browser computed-style fixtures establish rule equivalence, not native integration.

For every matched affected element capture getBoundingClientRect x/y/width/height and computed display, position, grid-template-columns/rows, flex-direction/basis/grow/shrink, gap, width/height/min/max, margin/padding, overflow, border widths/colors/radii, box-shadow, background/color, font family/size/weight/line-height, letter/word spacing, white-space, direction, text-align, visibility, opacity, z-index, transform, transition property/duration/delay, animation name/duration/delay/iteration-count. Capture before/after pseudo-element content and geometry for disclosure/XP/control indicators. Inspect hover, keyboard focus-visible, active, expanded, hidden and disabled states by real locator actions; include focus rings and no horizontal overflow at narrow widths. Check scrollHeight/clientHeight and scrollWidth/clientWidth to catch clipping and pinned footer changes.

Pass criteria: computed property strings match except justified serialization differences; rectangle deltas <=0.5 CSS px and no changed wrapping, clipping, target dimensions or focus visibility. Screenshots under identical conditions have no changed component geometry/colors; any residual font antialias differences require inspection rather than blanket tolerance. Reduced-motion computes no animation and zero transition durations for affected elements including vendor graph nodes. Every discrepancy is investigated before accepting the batch; native-only or unavailable states are reported as unverified, never counted as passing.

## Repeated selector inventory

Line references describe the frozen audited CSS, not future edited locations.

| Selector group | Scope | Current lines |
| --- | --- | --- |
| `.app` | base | 42, 1268 |
| `.topbar` | base | 45, 2005 |
| `.stream` | base | 107, 129 |
| `.msg` | base | 108, 130 |
| `.line` | base | 109, 161, 2122 |
| `.wu` | base | 110, 162 |
| `.wg` | base | 111, 167 |
| `.chat-head` | base | 112, 115, 1381, 2152 |
| `.conversation-title .chat-heading-label` | base | 117, 1896 |
| `.chat > .chat-head` | base | 119, 1895 |
| `.msg.bot` | base | 131, 151 |
| `.msg.me` | base | 136, 141 |
| `.composer` | base | 187, 1269 |
| `.scaf` | base | 198, 311, 1534 |
| `.scaf:hover` | base | 203, 317 |
| `.steer-row` | base | 204, 1536 |
| `.steer-select.topic` | base | 210, 1537 |
| `.scaffold-block` | base | 226, 1529 |
| `.scaffold-toggle:hover` | base | 248, 265 |
| `.scaffold-groups` | base | 269, 1531 |
| `.scaffold-row` | base | 273, 1532 |
| `.scaffold-label` | base | 274, 1533 |
| `.break` | base | 348, 1733 |
| `.popup` | base | 558, 1792 |
| `.graph-body` | base | 764, 1587 |
| `.graph-inspector` | base | 830, 1588 |
| `.gnode` | base | 913, 922 |
| `.quick-toggles` | base | 1005, 1539 |
| `.quick-toggle` | base | 1009, 1540 |
| `.coach-thread-head` | base | 1019, 1484 |
| `.settings-scroll` | base | 1134, 2129 |
| `.persona-open` | base | 1204, 1941 |
| `.settings-nav` | @media (max-width: 860px) | 1240, 1253 |
| `.settings-search` | @media (max-width: 860px) | 1247, 1254 |
| `.lesson-content` | base | 1386, 1416 |
| `.practice-board` | base | 1394, 1822 |
| `.practice-card` | base | 1408, 1743 |
| `.persona-config` | base | 1497, 1538 |
| `.chat-settings-block` | base | 1519, 1535 |
| `.chat-section-heading` | base | 1524, 1920 |
| `.graph-explore .graph-inspector` | @media (max-width: 860px) | 1590, 1597 |
| `.activity-selection` | @media (max-width: 860px) | 1592, 1633 |
| `.activity-selection select, .pipeline-picker select` | @media (max-width: 860px) | 1593, 1600 |
| `.activity-call` | base | 1619, 1669 |
| `.crow .mic-cancel` | base | 1673, 1678 |
| `.learner-profile-bar` | base | 1715, 1866 |
| `.learner-profile-bar > button` | base | 1716, 1867 |
| `.learner-profile-bar > span` | base | 1719, 1868 |
| `.conversation-map.is-open .conversation-map-toggle` | base | 1737, 1831 |
| `.message-translate` | base | 1763, 1799 |
| `.mobile-conversation` | @media (max-width: 860px) | 1776, 1901 |
| `.mobile-conversation .stream` | @media (max-width: 860px) | 1778, 1903 |
| `.mobile-conversation .mobile-composer` | @media (max-width: 860px) | 1780, 1904 |
| `.mobile-conversation .break` | @media (max-width: 860px) | 1781, 1905 |
| `.msg .line .wu` | base | 1802, 2123 |
| `.conversation-map-branches progress` | base | 1810, 1817 |
| `.inline-xp-badge:hover, .inline-xp-badge:focus-visible` | base | 1846, 2164 |
| `.topbar` | @media (max-width: 860px) | 1910, 2014 |
| `.summary-options > span` | base | 1924, 1925 |
| `.reaction-excerpt .msg` | base | 2116, 2118 |
