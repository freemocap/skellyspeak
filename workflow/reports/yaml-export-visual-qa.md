# YAML export visual verification — 2026-09-13

## Scope and environment

Rendered production `ConversationExport`, `LearnerModel`, `YamlExport` and
`DetailDialog` in the existing ignored `.local/learner-model-qa` browser fixture,
using the already-running Vite server. IPC supplied clearly marked synthetic YAML
(80 long lines including Arabic and Spanish), and a synthetic saved path. No file
was created by the fixture and no provider was contacted. No app/server was
started or stopped during this verification.

Native verification remains pending: process inspection confirmed the running
`SkellySpeak Dev.app` in this workspace (PID 24946), but computer-use access to
that exact app reported the Mac was locked and automatic unlock failed. The
conversation gear entrypoint and real native View/Save were therefore not visually
verified. Unit/native tests are separate evidence, not a substitute for that check.

## Observed defects and fixes

- Before View, the conversation dialog was 580px wide; loading the preview changed
  it to 880px and rearranged the controls. Its width now follows the always-present
  export toolbar. Measured 880px both before and after View at desktop width.
- Checkboxes and action buttons previously shared irregular wrapped rows. Each
  option now has its own compact row; View/Save remain together below.
- Reduced oversized heading/paragraph spacing within the shared export dialog.
- Status and error text are siblings of the toolbar, not its children. Applied
  wrapping to the actual sibling paragraphs and theme-aware error ink, including
  long unbroken saved paths.

Changes are confined to `src/styles/practice.css`.

## Rendered checks

- Conversation YAML: both options toggled, View rendered the production preview,
  Save displayed the synthetic returned path. This proves UI presentation only,
  not native export correctness or successful file creation.
- Desktop light: stable width and local horizontal/vertical preview scrollbars.
- Dark at 360 × 800: 320-character unbroken synthetic filename wraps inside the
  dialog. Document scroll width was 360px; dialog client/scroll widths both 307px.
  Preview client width 266px versus scroll width 1686px: long YAML scrolls locally.
- Learning evidence: clicked View YAML from the real learner-model component, then
  View YAML in its dialog; inspected the light preview at 360px.
- Keyboard: preview receives visible focus; ArrowDown/ArrowRight moved its scroll
  offsets to 14px/13px. Escape dismissed the conversation export dialog.
- Backdrop click on learning YAML returned to the learning-evidence dialog.
- Temporary browser viewport override restored after testing.

Screenshots were inspected in computer-use tool output; no image artifacts were
saved to the repository. These are actual rendered-component checks with mocked
IPC, not a claim about the locked native application.

## Checks

`npm run styles:check` passed after the CSS changes. Parent separately verified the
YAML behavior tests. No further styling defects were observed in these cases.
