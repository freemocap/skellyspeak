# Independent conversation wiring audit

Date: 2026-09-13. Scope: read-only source and local saved-data audit requested by the user. The only audit write is this report. No provider requests, credential reads, server starts, source changes, or Git writes were performed.

## Conclusion

The reported behavior is real in the saved conversations. The negative music answer is especially decisive: the contact responds with an affirmative first-person answer to its own earlier question. However, the local captured request for that exact exchange contains the expected **system → assistant opening → user answer**, with no invented user preface. I did not find a source-level role, history-order, or response-association defect that explains these first responses.

This does **not** establish that the live hosted provider received that exact array. Saved context is an input to transport, not a packet capture. The running hosted deployment and its upstream provider conversion were not observed. Do not declare the issue solved, or declare it solely a model-quality issue, from this audit.

## Findings and severity

### High: incorrect conversational behavior confirmed; root cause unresolved

Bounded examples from the local SQLite database, opened read-only:

| Attempt | Captured assistant message | Captured last user message | Published assistant response |
|---|---|---|---|
| Music original | Hola. ¿Te gusta la música? | Si me gusta música. | Sí, me gusta mucho la música. Estoy haciendo una lista de canciones para una boda. |
| Music replacement | Hola. ¿Te gusta la música? | No, no me gusta música. | Hola. Sí, me gusta la música. ¿Qué haces ahora? |
| Swimming replacement | Me gusta mucho el mar. ¿Te gusta nadar? | Sí, me gusta mucho nadar. | Sí, me gusta nadar en el mar. Lo hago por la mañana en verano. |

Each of these captured arrays contains exactly three messages: system, assistant, user. Both requested and recorded actual model are `google/gemini-2.5-flash`; route is hosted. The replacement music message is stored as the replacement turn's user message, and the replacement request excludes both the predecessor answer and its response.

The current music system prompt has 7,529 characters and starts exactly with the current `conversation_prompt.rs` BASE string. Neither the actual music opening nor the actual negative answer appears inside that system string. This establishes current prompt-version parity for that portion of the local capture, not full executable or deployed-service provenance.

### Medium: live boundary evidence and semantic regression coverage are missing

The checked source preserves messages through the client and server layers. Existing tests isolate those layers and use fake completions. They do not establish that the deployed service and provider handle the three-message opening pattern correctly. The grouped server test verifies schema forwarding and response metadata but does not assert the entire system/assistant/user array. The native grouped HTTP test uses a one-message `user: Hello` fixture, which cannot detect handling specific to an assistant-first exchange.

### Medium hypothesis: prompt instruction competition deserves controlled testing

`src-tauri/src/conversation_prompt.rs:7` contains extensive role guidance, several first-person examples, and both valid and explicitly invalid responses. The same block asks for independent preferences while also saying not to mirror preferences. `conversation_prompt.rs:13` asks Beginner replies to usually be two sentences and supplies a first-person shared-preference example. The saved music request also adds a practice focus about thanking, apologizing, and polite responses, unrelated to the current music question.

These are plausible competing pressures: many examples of first-person preference language and a two-sentence completion template surround the short real exchange. The request also explicitly and repeatedly says not to answer its own question. Inspection alone cannot determine which instruction the model followed or whether provider conversion intervened. This is a hypothesis for an A/B evaluation, **not a demonstrated cause**. Adding more special conversation wrappers or another synthetic user turn would obscure the investigation.

### Low: pagination and failure-path limitations are separate from this incident

Native generation reads its own most recent 40 eligible messages, independent of the UI's 100-message snapshot page. Therefore UI pagination cannot explain omission of the opening on a first response. Beyond 40 eligible messages the opening naturally leaves context; failed/cancelled sends with retained user messages may also produce consecutive user messages. Neither condition is present in the inspected three-message examples. Repeatedly edited predecessors still count toward the UI page limit, even though the main view filters them; this is a separate presentation-capacity concern, not the demonstrated self-answering cause.

## End-to-end trace

1. **Start control:** `src/features/guided/GuidedPage.tsx:329` sends `startConversation` for the reviewed conversation, with ownership checked again after asynchronous work. `src-tauri/src/store.rs:349` dispatches that action to `openers::accept`.
2. **Opening creation:** `src-tauri/src/openers.rs:160` creates an opening-generation brief. `execution.rs:302` passes it into `accept_turn`. This app currently makes a separate AI call to generate the opening; it does not choose all openings locally. That generation call has a user brief, but `execution.rs:504` deliberately does not persist that brief as a human chat message. Its generated output is published as an ordinary assistant message at `execution.rs:1399`. No opening brief is injected again into the subsequent conversation request.
3. **Human send:** `useConversation.ts:128` sends only the human text, input provenance, conversation identity, and revision. It does not assemble LLM history in React. It reads fresh native ownership/revision, checks the expected conversation ID, and native acceptance rejects another outstanding reply (`execution.rs:362`). Speech transcriptions enter the same text-submit path (`GuidedPage.tsx:433`).
4. **Native history:** `execution.rs:451` selects this conversation's persona-reply and persona-opening messages, excludes replaced turns and the turn being edited, orders by sequence descending, takes 40, and reverses to chronological order. Lines 453–465 prepend one system message and append the new user answer. `sourceIds` contains selected stored messages. The captured JSON is persisted with the turn before execution at line 502.
5. **Editing:** `src-tauri/src/revision.rs:31` requires a current active exchange. Lines 66–80 invalidate outstanding predecessor work and remove the later dependent suffix. Lines 87–105 accept the edited user text, excluding the old exchange from history, then record the replacement relationship. The latest saved music and swimming captures demonstrate that exclusion actually occurred. The original records remain internally for evidence; the main current conversation filters `replacedBy` (`GuidedPage.tsx:397`).
6. **Dispatch:** `execution.rs:992` validates captured roles and bounds without constructing another prompt. For persona reply/opening, `execution.rs:1206` deserializes the captured messages unchanged; helper operations have their own separate branches. The returned dispatch carries the captured target, route, model, operation, and attempt.
7. **Serialization and route:** `src-tauri/src/provider.rs:188` puts the dispatch array directly into JSON `messages`. `src-tauri/src/grouped.rs:225` wraps each independently serialized request with its operation/attempt IDs. `src-tauri/src/lib.rs:1052` selects grouped transport for hosted requests. Group compatibility checks route, endpoint, credentials, revision, and installation; it does not merge their message arrays.
8. **Hosted forwarding, checked source:** `server/grouped.py:43` validates each item; `server/contracts.py:36` validates roles/content. `contracts.py:88` shallow-copies the payload and changes only token/provider policy fields. `server/main.py:693` calls the upstream chat endpoint with `json=item.contract.payload`. There is no conversation-specific prompt rewriting or role conversion in this checked server path. Hosted routing disables fallback and uses the approved model. This is source evidence, not proof of the deployed revision.
9. **Response attribution:** `grouped.rs:174` verifies the returned operation AND attempt against pending identities. Lines 279–286 find the corresponding dispatch index, not arrival order. `lib.rs:1053` finishes that dispatch. `execution.rs:1267` requires the matching running attempt, operation, and live turn before publication; cancelled/revised late results cannot publish. Assistant prose is inserted into that turn's conversation with the next sequence. Gloss/translation/coaching results take separate branches, not the chat-message insertion branch.
10. **UI projection:** `execution.rs:817` reads persisted message roles and turn IDs. `src/domain/language/conversation-view.ts:8` groups by durable turn identity and maps stored assistant text directly to `assistant.reply`; it does not zip neighboring messages or substitute a translation. `useConversation.ts:63` disposes old watchers on conversation change and rejects scope mismatches. The visible bad response therefore corresponds to actual saved assistant text, not a client-only swapped bubble.

## Verification and its limits

- Independently ran `server/.venv/bin/python -m pytest server/test_grouped.py server/test_contracts.py -q`: **38 passed**. These exercise local server handlers/contracts with fake upstream and storage, not deployed inference.
- Reviewed `wave2_partner_opening_is_real_history_without_learner_evidence` (`execution.rs:5505`), including the parent's current added assertions: exact three-message capture, payload preservation, edited negative answer replacing original context. This proves native capture/payload construction using simulated output. I did not independently rerun that Rust test during this audit.
- Reviewed grouped identity/duplicate/out-of-order/partial-result tests (`grouped.rs:373`, `:392`, `:422`) and source callbacks. These guard attribution but do not evaluate conversational meaning or assistant-first provider behavior.
- Local saved examples prove a real accepted user answer and a real bad published reply around a correctly shaped saved context. Their attempt metadata reports the actual model; that metadata is provider-supplied and does not prove an upstream request-body hash.
- No live provider body, production revision identity, provider adapter conversion, or new live semantic result was obtained. No full system/persona/credential data was emitted.

## Concrete next test

First add a deterministic boundary-preservation regression: feed **system → assistant opening → user negative answer** through native grouped HTTP serialization and the Python grouped handler into a fake upstream; assert exact role/content equality, and return uniquely tagged responses out of order for a second unrelated helper operation. Assert that each response reaches its original turn. This closes the existing assistant-first and grouping test gaps without modifying the conversation shape.

Then, with explicit authorization for live inference and a verified deployed revision, run a small synthetic canary using the same three messages. Record sanitized role/content at the outbound boundary, exact request hash, response, provider model, and deployment revision. Compare positive and negative answers to the same opening; include one factual answer that should trigger an unmistakably different follow-up. Run the current prompt and a minimal ordinary conversation prompt under the same model/settings. Do not change roles, add a user preface, or alter the opening between arms. Repeated samples are necessary because one successful completion is not a fix. If both receive identical verified arrays but only the large prompt fails, prompt competition becomes supported; if the provider-bound array differs, repair that boundary first.

## Authorized offline follow-up

Implemented the deterministic boundary tests after authorization to continue. Production prompts, message roles, history assembly, and routing are unchanged.

- The native grouped HTTP test now sends the exact three-message negative music exchange, both alone and alongside an unrelated structured word-help request. The loopback receiver asserts complete role/content equality for both requests, including accents, and separation of output contracts. Unique fake responses arrive in reverse request order and remain attributed to the correct dispatch index. Existing truncated-stream assertions still run for both Hosted and Custom routes.
- `server/test_grouped.py` now passes that same conversation plus independent word-help messages through `grouped.parse`, `grouped.results`, and the route's real `execute_grouped_item`, into a mocked HTTP upstream. An event holds the conversation response until the helper result is observed. Assertions check the complete upstream message arrays and each returned operation ID, attempt ID, provider response ID, and unique content. No timing sleeps or real inference are used. This exercises the route's parser/executor/stream components directly; it is not one cross-process native-to-Python integration test.
- Verification: **5 native grouped tests passed**, including all eight HTTP fixture configurations; **39 server grouped/contract tests passed**. The native socket test initially hit sandbox loopback restrictions, then passed with approved loopback execution. No external service, credentials, or application data were used.

These close the local assistant-first payload and concurrent attribution coverage gaps identified above. They do not resolve the bad semantic response or verify the deployed service/provider conversion. The next decisive step remains a verified live boundary/semantic canary; the expected conversation shape remains system → assistant → user.
