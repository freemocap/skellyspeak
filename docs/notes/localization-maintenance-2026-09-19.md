# Localization maintenance — 2026-09-19

Status: implemented source changes and verification, not a deployment.

## Findings and cleanup

The starting catalogs had 1,030 matching messages each, but matching keys did not
mean all messages were still used. Reviewed the direct and dynamic translation
callers and searched active UI, native, content and preview sources. Removed
154 unused entries from each locale: 132 had no active textual references;
another 22 were confirmed obsolete after reviewing substring-only matches and
unrelated native/content occurrences. These included retired coach-thread controls,
lessons/quiz UI, tree layouts, old progression instructions and short keys such as
“Map” and “New chat” that appeared only inside identifiers or longer UI messages.
Tests and archived sources did not justify retaining an entry.

Added 155 distinct messages for the 54 skill catalog entries (labels, descriptions
and criteria; domain criteria share a message), plus 17 assistance, outcome, lens,
modality and tooltip messages. Net result: **1,048 messages per locale** across
English, Arabic, French, German, Mandarin, Portuguese and Spanish.

The repeatable audit reports **834 direct translation references, 214 other
source/data references and zero unreferenced candidates**. These are key counts,
not call-site counts. The 214 are conservative references, not a claim that every
one is reachable at runtime. The audit now matches exact TypeScript literals and JSON values. Native/YAML
textual matches can still conceal obsolete entries; the audit intentionally does not auto-delete.

## Implemented behavior

- Skill list, overview, learner estimates, evidence, progress, reward cards and
  accessible reward descriptions translate authored catalog text when displayed.
- Outcome, assistance, input-modality and learning-lens labels are localized.
- Speech measurements, learner decimals, account amounts and affected XP/count
  displays use the selected interface locale. Machine values and scientific time
  axis direction remain unchanged.
- Coach-term and credential-preview tooltips are translated.
- Shell alignment, notices, settings spacing and Markdown indentation use logical
  CSS properties. The intentional Arabic-message alignment stays explicitly right.
- Builds validate every generated skill label, description and criterion against
  the dictionaries. JSX expression/conditional/template text and accessibility
  values are checked; locale-independent decimal formatting in TSX is rejected.
- CI runs typed checker tests and the conservative usage audit.

No native schema, scoring, identity, model prompt or generated contract changed.
Stored learner text and assessment rationale are not translated or rewritten.
Technical diagnostics, provider identifiers and authored source inspections remain
verbatim; general dynamic-content localization is not proved by the static checker.

## Verification

- UI suite: 802 tests passed across 125 files, including all seven skill locales,
  locale switching without losing category/selection, preserving source evidence,
  and localized speech decimals with the scientific axis kept left-to-right.
- Checker tests: seven passed; TypeScript checks passed.
- Build, locale validation/audit, styles, design-system and preview checks passed.
- Browser fixture: German and Arabic inspected at desktop and 390px widths; no
  horizontal document overflow at 390px. Skill labels, criteria, reward amounts,
  direction, wrapping and coach-term tooltips were checked. This was a production-
  component fixture, not a live native-session end-to-end test.
- Updated the generated design-system CSS bundle from its source.

The new translations have not received independent native-speaker editorial review.

## Removed message keys

The list records the reviewed removal set for this pass. It is historical audit
data, not an allowlist or a reason to restore retired product behavior.

- ` Talk to your coach`
- ` XP · Skill map`
- ` pending · `
- ` · rules `
- `AI exchange`
- `AI — understand recent activity, inspect a pipeline, or open debugging tools`
- `Any topic`
- `Assessment activity · `
- `Chat settings`
- `Clear coach thread`
- `Clear thread`
- `Close node details`
- `Close ×`
- `Coach panel`
- `Coach thread clearing is not available yet.`
- `Conversation skill map`
- `Current conversation settings`
- `Custom regional variety`
- `Drag to resize. Arrow Up or Down adjusts height; Enter collapses or expands.`
- `Every 50 XP earns a domain star. The bar shows progress toward the next star.`
- `Follow recommendations`
- `Guided conversation`
- `Inspect skill map`
- `LANGUAGE PROFILE `
- `Open XP & coach ▸`
- `Open full details`
- `Persona is unavailable.`
- `Profile revision `
- `Profile: `
- `Reading and voice options`
- `Recommended focus`
- `Recommended focus: least recorded XP`
- `Recorded audio is not retained here. Only this temporary inspection is available while the conversation stays open.`
- `Regional variety`
- `Regional variety presets`
- `Related skills`
- `Reload app (⌘/Ctrl+R)`
- `Resize coach panel`
- `Selected node`
- `Settings & voice`
- `Show token translations`
- `Skill map`
- `Talk to your coach`
- `Three unassisted successes earn a star. Map arms and branch bars fill with credited XP, including assisted practice, up to 30 XP per skill. XP totals continue growing after a bar fills. Stars are separate milestones, not proficiency grades.`
- `Tree layout`
- `Tree location`
- `Use for AI requests`
- `Whole tree`
- `Your coach`
- `Your coach will follow the conversation here.`
- `You’re not signed in.`
- `…or type a custom variety`
- `← Back`
- `◆ Practice focus`
- `○ No success`
- `✓ One · ✓✓ Two · ★ Three`
- `Available in the recommended path.`
- `BROWSER DEMO`
- `Collapse coach thread`
- `Collapse map`
- `Expand coach thread`
- `Expand map`
- `Extension: build three successes in its parent, or choose it now.`
- `My language profile`
- `PROFILE & EVIDENCE SAVED LOCALLY`
- `Pinned focus`
- `Preview focus`
- `SELECTED`
- `You start`
- `◆ FOCUS`
- `★ Star earned`
- `Token translations`
- ` · {value0} turns`
- `{value0} XP · ★ {value1}`
- `{value0} · {value1} XP`
- `{value0}/3 unassisted successes`
- `★ {count} successes`
- `{mark} {count} conversations · {xp} XP`
- ` · {count} assisted`
- `Right-left`
- `Left-right`
- `Radial`
- `Top-down`
- `Request a topic`
- `Practising in chat`
- `Task completed`
- `Practise with the coach`
- `Ask the coach or try the exercise`
- `Try it in chat`
- `Continue chatting`
- `End practice`
- `Practical situations`
- `About the language`
- `Past tense`
- `Asking questions`
- `Word order`
- `History and language family`
- `Alphabet and writing system`
- `Sounds and spelling`
- `Test your understanding`
- `Correct · +1 XP`
- `Correct answer: `
- `Letters and sounds`
- `Reading words`
- `Pronunciation and stress`
- `No matching starter topics. You can still start a conversation.`
- `Start the conversation`
- `Objective`
- `Quiz`
- `Next step`
- `Teacher`
- `Engineer`
- `Not configured`
- `Sign in to use AI`
- `Add API key`
- `Connect a custom server`
- `or pick a topic`
- `Explanation context`
- `Use this language and variety`
- `Definition and usage`
- `Teaching guidance`
- `Learning goals`
- `Conversation starters`
- `Language-specific goals`
- `Server reachable · session token accepted`
- `Server reachable · authentication disabled`
- `Checks server access and protocol. Provider keys and model access are verified when making requests.`
- `Chat feedback is separate from skill tracking. Saved skill evidence remains available.`
- `Model judgments about this message, not proficiency measurements. No skill XP is awarded.`
- `Transcription access`
- `Read-aloud access`
- `Chat access`
- ` failed`
- ` stars`
- `Delete the saved `
- `Exchange `
- `Inspect `
- `Native`
- `New chat`
- `Nothing matches “`
- `Cards`
- `Map`
- `0 XP`
- `Reading`
- `Practice`
- `Learn`
- `or`
- `Examples`
- `Exercise`
- `Less`
- `Configured`
- `Listening`
- `Conversation`
- `Listen`
