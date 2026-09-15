# U1 Arabic reading consistency — completed source handoff

Base revision: 5e006989a2f5d9376952a3cf55f6d713aee6e9f3 (shared uncommitted checkout). Integration approved this bounded change.

Edited only the owning Arabic size rule and composer field rule in src/styles.css, plus dir="auto" in src/components/chat/ComposerInput.tsx. Shared source size is calc(19.2px * var(--reading-scale, 1)); nested saved-gloss wrappers no longer multiply em sizes. Passive user/assistant text and RTL composer use the same size. Existing fonts, natural spacing, source content and word boundaries are preserved. Language reviewed the shaping/source boundary; no native contract or inference changes.

Actual-component synthetic browser fixture baseline measured user/passive source 16px, saved-gloss outer wrapper 18.6px and inner word 22.32px; composer was LTR. After: all source presentations/composer 19.2px, RTL, line height 32.64px. At 150% all measured source sizes are 28.8px. Desktop and 390×844 screenshots inspected; narrow document width equals viewport width, composer bottom 834px, word joining and diacritic remain visible. Enter reveals the saved gloss with visible focus. Synthetic phrase: هذا كتابٌ. مرحبا كيف حالك اليوم. No generated/provider output.

Temporary review fixtures: http://127.0.0.1:1423/arabic-after-1.html and /arabic-after-1.5.html, served from /tmp/skellyspeak-coach-sizing. These bundle actual components and explicitly say fixture/no inference. This is browser fixture verification, not native WebKit/device QA.

Verification: styles:check passed; production build passed; 80 frontend test files / 396 tests passed. No Git writes. Code Quality review requested on these three bounded edits, not the entire concurrent checkout diff.

Independent Code Quality review completed: no actionable findings in the bounded Arabic edits; style checker independently passed. Review did not rerun the full suite or claim native QA.
