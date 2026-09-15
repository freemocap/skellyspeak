> Current presentation: compact Difficulty dropdown beside Native, superseding the earlier slider decision. See U1-header-access-correction.md.

# Conversation controls and contact profile — design history

The bounded slider, profile editor and existing-contact chooser are now authorized and implemented; see [source handoff](U1-contact-settings.md). Remaining generated-persona lifecycle proposals are deferred.

## Observed source

GuidedPage displays difficulty/topic from useSteering in the heading, while its level/topic fieldset is explicitly disabled with “Conversation steering is not connected yet.” useSteering stores those values per device in localStorage; that is not the DESIGN.md conversation-owned difficulty model. Do not present the current heading as proof that durable prompt steering works.

PersonaField reads real workspace records named partners internally. Selecting a contact creates another conversation; the dice action currently starts a new contact/chat. Details are read-only name/background/tendencies/Vibe. It has no persistent profile editor. Selection should make the conversation-creation consequence explicit.

## Recommended compact arrangement

Place Difficulty directly beside Target language and Explanation language: Absolute zero, Beginner, Intermediate, Advanced, Fluent. Label it Difficulty, not Learner level; remove implied CEFR equivalences from this presentation. It expresses chosen challenge, independent of assessment/XP. Persist against the current conversation, show pending/error, and apply to subsequent work after a successful save. Beginner is the approved default. The approved control is one discrete slider with five labeled stops. Proposed edit timing is the next accepted send, preserving already captured turns. Existing saved target language stays fixed; choosing another language starts/selects an appropriate conversation rather than relabeling its history.

Keep global contact management in the existing contact chooser, with a Contacts destination that can expand to a full management surface. Prefer this over a new top-level Personas tab initially: it preserves approved navigation while making every contact accessible. Offer explicit New contact, Edit contact and Open conversation actions. Show current contact name in chat with a Profile action opening a contextual Profile tab beside Lesson/Analysis; it displays the same persistent contact, not a second copy of settings. Coach remains separate and on the roadmap.

Profile uses current supported identity fields: name, fixed target language, background, conversational tendencies and authored Vibe. Group compactly; collapse longer background detail. Editing updates that contact across its conversations; creating another person is a separate action. A generated persona followed by explicit Add to contacts is a future lifecycle proposal only. History retention and ownership before that action remain unresolved; neither automatic persistence nor an implementation sequence for this lifecycle is authorized.

Contact owns identity/background/tendencies/avatar/authored Vibe. Relationship owns shared memories and conversation association. Conversation owns difficulty, topic intent and assistance. Private coach discussion/assessment never enters contact memories. Topic, if retained, is optional conversational intent rather than a fixed category or a reason to create a new conversation; omit inert controls until supported.

## Review and implementation boundary

This changes control placement and adds profile editing, so present the concrete arrangement to the user before broad implementation. AI Operations is reviewing exact prompt effects, edit timing and minimum fields. Integrate in bounded steps: authoritative difficulty save/read + prompt evidence; durable profile editing + validation; contextual profile and global management using shared data/components. No new controls, production contract, schema or inference implemented by this proposal.

## AI Operations coordination received

See [AI semantics proposal](A1-conversation-challenge-persona-proposal.md). Five choices have concrete proposed prompt effects, independent of assessed proficiency. The user settled on the same pipeline and assistance at all five levels, with only prompting differing. No special Absolute-zero cue, suggestion or mechanism is adopted. Beginner is approved as the default. No legacy difficulty compatibility mode is permitted. The earlier preserve-old-behavior recommendation is withdrawn; no data rewrite or migration is authorized by this proposal.

Existing profile validation supports name (80 characters), background (2,000), tendencies (600), up to eight allowlisted Vibe symbols and an avatar recipe. Avatar remains presentation only. AI suggested bounded local random creation; the newer generated-persona/Add to contacts lifecycle discussion leaves persistence and history ownership unresolved, so that earlier persistence recommendation is not adopted. Saved difficulty/profile changes affect the next accepted send; accepted/in-flight/retried turns retain captured settings and partner revisions. Contact edits apply across that contact’s conversations. Topic remains omitted until supported. These are coordinated proposals, not implemented behavior.

## Settled terminology, unresolved placement and lifecycle

Use Contact/Contacts in product labels, as recorded in DESIGN.md. Internal identifiers and existing source are unchanged. Contacts collection placement and contextual Profile placement remain proposals. Terminology approval does not approve profile UI, generated-persona persistence, history retention or lifecycle implementation.

## Integration review corrections

The approved bounded slice covers Difficulty beside languages as one five-stop slider with Beginner default, contextual Profile and Contacts through the existing chooser. Authored Vibe stays intentionally abstract; this proposal does not adopt deterministic textual mappings. Generated persona/Add to contacts lifecycle remains deferred. Implementation authorization is limited to that bounded slice; no data rewrites are authorized to U1.

Integration separately reported three live QA turns (two Chinese, one Arabic), all with v2/v4 gloss completion on the first attempt and successful voice. This is integration-reported evidence, not independent U1 native verification or a general quality guarantee.
