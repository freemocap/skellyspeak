# Chat reply → Drill phrase

Implemented: completed AI reply bubbles have a quiet plus action in their reading
footer. It copies the full reply, stays in Chat, and changes to a disabled check
on successful save. Pending saves reject repeat clicks; failures remain visible
with expandable response details and allow explicit retry. Learner bubbles,
streaming placeholders and other reading surfaces do not receive the action.

Ownership: the conversation owns AddToDrillButton, the shared TargetMessage accepts
an optional React action slot, and saving calls the existing platform/ipc/drill
createDrillItem adapter. Neither feature imports the other. Existing native
validation, storage and Drill reload-on-activation are reused. The captured
conversation reading scope supplies language/variety and explanation scope.

This is a copied ordinary phrase, not a linked conversation-source record. It
retains the existing 512 UTF-16-unit validation limit, with no silent truncation
or automatic splitting. Success state is local to the mounted message; revisiting
a chat can offer the action again. Persistent deduplication was not added.

Verification: 65 tests passed across the new action, TurnView, TargetMessage and
architecture boundaries. Full UI and preview TypeScript checks, style policy and
localization audit passed. The design-system CSS bundle was regenerated. Browser
fixture reviewed at 390×844 and 1280×900; simulated save changed plus to a disabled
check. Fixture IPC returns a receipt only; no real phrase was created in the
user workspace during browser verification. No native storage code changed.

Changes remain uncommitted. The pre-existing native continuous-recording test
changes were not modified.
