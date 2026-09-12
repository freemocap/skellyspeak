# Styling audit

Scope: active React components, inline styles and the stylesheet root. Source inspection
and automated verification are complete for this pass; live visual QA is pending.
The styling agreement is in `ui-guidelines.md`.

## Findings addressed

- Consolidated seven exact repeated selector groups within their media scope:
  root variables, learning panel, onboarding, settings dialog, access capabilities,
  and narrow-layout header actions/navigation label. Kept the intended effective
  values and removed redundant declarations.
- Removed selectors for eight absent component classes after checking active source:
  conversation-top, evidence-summary, panel-content, large-text, account-trigger,
  signed-account, conversation-navigation and access-provider. Kept dynamic message
  roles and workspace mobile-state selectors.
- Removed both `!important` declarations. Paper-pane button borders explicitly
  exclude primary actions; the AI dock receives its size through a CSS variable,
  allowing responsive CSS to own mobile height.
- Fixed message-input reading-size scaling being superseded by a fixed font size.
  Reading typography now lives with the message/input component rules.
- Added a CSS parser check for repeated rule groups, repeated properties and
  `!important`, with PostCSS declared as a direct development dependency.

## Recommendations and remaining inspection

1. The stylesheet is split by surface under `src/styles/`, with `index.css` as the
   import manifest. `npm run styles:check` enforces one owner per selector across
   files and keeps literal colours, sizes, weights, radii, durations and layers in
   `tokens.css`. Group future component additions with their owner.
2. Use the semantic colour roles and the spacing scale in `tokens.css`. When a
   surface needs a colour no role covers, add a primitive to the palette and a role
   that names its purpose, rather than reusing a numerically similar colour.
3. Review shared form/notice spacing and nested settings margins in the app. Avoid
   another global padding reduction until the affected surfaces are visible.
4. Inspect remaining broad light-pane input/button selectors against hover, focus,
   disabled and recording states. Source checks cannot establish computed contrast.
5. Check desktop dock resizing and narrow full-screen AI layout, 75–150% reading
   size, settings scrolling/dismissal, and composer alignment. The user is performing
   app QA; no native visual pass is claimed here.

No provider, storage or request-admission behavior changed. Auto-send, audio settings
and the interactive execution graph remain separate implementation work.
