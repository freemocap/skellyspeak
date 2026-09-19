Tabs across the top of a panel (`.panel-tabs` > `.panel-tab`), e.g. Conversation / Coach.

Source: `ui/src/styles/components/buttons.css`. Markup only: a `.panel-tabs` row of `<button class="panel-tab">`; add `.active` (and `aria-selected="true"`) to the current tab.

## Rules
- The active tab joins the `field` surface below it: `interaction-ink` text and border, no bottom border.
- Inactive tabs sit on `chrome` in `ink-2`. Keep labels to one or two words.
- Use tabs for sibling views of the same panel, not for navigation between pages.
