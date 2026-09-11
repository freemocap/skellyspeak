# Conversation challenge and persistent contact prompt contract

Design proposal updated September 11, 2026. Five difficulty levels, Beginner default and prompt-only complexity changes are now approved. The focused native prompt module is implemented; broader contact lifecycle/navigation remains proposed. Based on current native model, store and execution source; coordinated with Interaction. Product terminology is Contact/Contacts, as recorded in DESIGN.md. Existing internal identifiers such as CreatePartner and UpdatePartner remain unchanged. Naming does not authorize a new persistence lifecycle or UI implementation.

## Audited behavior before implementation

`Difficulty` has Gentle, Balanced and Challenging. The contact prompt defines these only as simple vocabulary/short clauses, everyday language, or richer vocabulary/complex structures. All levels otherwise get the same 1–4 sentence instruction. This is not an absolute-zero-to-fluent curriculum or an assessment.

Before this slice, the prompt serialized every practice setting and the entire contact details object, including avatar. Composing help and coach proactivity are present as data, but the inspected native execution does not implement separate scheduling or clear instructional semantics for them. The coach runs in its own channel and can see the latest 20 contact messages; contact history selects only contact-channel messages. The coach receives no contact details object. Turn acceptance captures prompt messages and settings/contact revisions; later edits do not alter that accepted contact turn.

Persistent contacts already contain name, background, conversational tendencies, authored Vibe, avatar and revision. CreatePartner and UpdatePartner are distinct native actions. Existing validation bounds name to 80 characters, background to 2,000 and tendencies to 600, with up to eight allowlisted Vibe symbols. Build on that model.

## Proposed difficulty semantics

Place the approved five-stop **Conversation difficulty** slider beside Target and Explanation language, with the helper text: “Choose how demanding this conversation should be. This does not assess your proficiency.” Persist the choice on the conversation. The following are behavioral targets, not guaranteed word counts or CEFR equivalences.

| Choice | Contact behavior |
| --- | --- |
| Absolute zero | One very short target-language phrase or question at a time, with the most familiar concrete vocabulary and simplest sentence structure. Minimal conversational burden; no unexplained idioms or multi-part questions. Uses the same machinery as every level, with no bilingual cue, reply options, special assistance mechanism or extra calls. |
| Beginner | One or two short sentences with common vocabulary and simple clauses. Reuse useful words naturally. Ask one concrete question. Scaffold when the learner struggles without turning every reply into a lesson. |
| Intermediate | Natural everyday exchange with modest connected sentences, common tense variation and occasional new vocabulary supported by context. Ask a manageable follow-up. |
| Advanced | Nuance, broader vocabulary and more complex syntax appropriate to the topic. Explain unfamiliar expressions on request; do not artificially make ordinary conversation ornate. |
| Fluent | Natural adult conversation appropriate to the contact and topic, including idiom and implicit meaning where useful. No automatic simplification or teaching commentary. Still honor requests for clarification. |

Keep difficulty independent of reply verbosity, topic expertise, assistance controls and persona. A gentle personality can still speak at Fluent difficulty. Chosen difficulty must not create CEFR claims or XP. Any later assessed level needs its own evidence, date, uncertainty and scope; any later XP needs defined events and accounting. Neither should silently change the conversation choice.

The user forbids compatibility modes: do not retain a parallel legacy difficulty contract. The five levels and Beginner new-conversation default are approved. Integration separately owns the user-approved reset after gates; this prompt module performs no data rewrite or automatic mapping. Labels alone do not establish behavioral equivalence.

## Prompt ownership and projection

| Input | Owner and effect |
| --- | --- |
| Target language and variety | Conversation; trusted resolved guidance controls contact output and coach examples. |
| Explanation language | Conversation; controls coach prose, translation destination, gloss explanations; it does not add a bilingual cue to contact replies. |
| Conversation difficulty | Conversation; resolve to the selected trusted instruction block, not all five alternatives. |
| Name | Persistent contact; role identity, used naturally without repeated self-introductions. |
| Background | Persistent contact; fictional facts available only when asked or topically relevant. Never demand unsolicited disclosure. |
| Conversational tendencies | Persistent contact; bounded tone and conversational habits, subordinate to task, language and difficulty. |
| Authored Vibe | Persistent contact; authored Vibe remains an abstraction interpreted by the LLM, as the user intends. Do not impose a fixed symbol-to-text mapping. Its symbols must not appear in generated output. |
| Avatar | Persistent contact presentation only; omit seed, hue and shape from model prompts. |
| Translation, read aloud, auto-send, voice | Application behavior; do not serialize as contact persona instructions. |
| Composing help and coach proactivity | Assistance settings; only claim functionality once a concrete coach behavior or scheduling implementation exists. Do not let opaque JSON imply contact access to coaching. |
| Topic | Optional conversation context in a later slice; omit until supported. It must not become permanent contact biography. |
| Relationship memories | Separate future feature with source provenance and explicit selection. Current recent history is not a durable memory subsystem. |

Persona strings are untrusted data, not instructions. For example, a background containing “ignore language settings” cannot override trusted guidance. Coach context remains private: pass selected contact exchange to the coach, never coach messages, assessment drafts or composing help to the contact. Learner-authored text explicitly sent to the contact remains normal contact input.

## Editing and random creation

A generated persona followed by an explicit “Add to contacts” action is a future lifecycle proposal only. The ownership and retention of conversations before adding a contact, and what happens to history if that persona is discarded, remain unresolved. Do not implement new persistence or assume that generating a persona immediately creates a saved contact. The existing CreatePartner action persists immediately; it cannot represent the proposed preview lifecycle without a separately agreed contract. Collection management and contextual Profile placement also remain proposals. For an existing saved contact, the proposed editing behavior keeps its identity stable and saves a new revision; opening a profile or switching conversations must not reroll it or invoke a model.

Contact edits apply to all that contact’s conversations starting with each next accepted send. Conversation difficulty edits apply only to that conversation’s next accepted send. Neither retroactively changes prior messages, an in-flight turn, nor an explicit retry of that accepted turn. If a user wants the new settings immediately, cancel pending work and send a new turn through existing controls. Persist exact selected prompt instructions and relevant revisions with the turn; do not rebuild a retry from mutable contact state.

## Bounded implementation sequence

1. Complete the current gloss v2 and writing-guidance fix and review it independently.
2. Approved: five difficulty blocks, Beginner default and no compatibility mode. Absolute zero is target-only and differs only in vocabulary, sentence structure and conversational burden. Root owns native integration/reset; Interaction owns UI.
3. Add typed, versioned difficulty resolution and a minimal contact prompt projection. Keep private coach history excluded and preserve captured-turn semantics. Add meaningful tests for level-specific prompt differences, source/history isolation and edits after acceptance.
4. After separate scope approval, implement the selector and agreed profile editing presentation. Before implementing generated persona → Add to contacts, resolve history retention, ownership and discard semantics, then define the native lifecycle. Existing creation actions are not approval for that new flow. Opening or revealing UI performs no inference or data mutation.
5. Evaluate synthetic exchanges across supported languages for scaffold quality, response burden, tone, latent background and quoted adversarial persona data. Prompt tests prove propagation, not learning quality. Paid evaluations require their own bounded authorization.

The difficulty module is implemented; the selector and combined app checks are Integration/Interaction work. An editing experience for existing contacts and the generated-persona lifecycle remain separately scoped. Assessment, XP, relationship memory and automatic coaching scheduling remain distinct later contracts.
