# Persona lifecycle follow-up: blocking credential admission

Independent review of `generation.rs` and native begin/run/cancel integration found a boundedness defect outside the previously known durable-receipt work: cancelling a generation drops the async keychain await, but cannot stop the underlying `spawn_blocking` OS call. Repeatedly starting and closing generations while native keychain access is blocked could therefore exceed the four-request limit with detached credential reads.

Implemented `admission::CredentialReads` and routed the shared `read_secret` helper through it. Four permits bound actual blocking calls; each permit moves into its blocking closure and remains there until the OS call returns, even when its async caller has been cancelled. Additional credential reads fail explicitly with `AdmissionHeld` and guidance to finish system keychain prompts. No Store lock is held while waiting. Voice, access checks, scheduler and persona generation all already use the shared helper; source search found no other production `credentials::read` call.

The synthetic regression starts four channel-blocked credential calls, aborts all four async callers, confirms that twenty further attempts cannot start any new blocking call, releases the original calls, and verifies permit reuse and release after a read error. No real keychain access or OS prompt was used.

Verification: all five `admission::tests` pass. Strict all-target Clippy with warnings denied also passed. No additional concrete generation lifecycle defect was found in the reviewed pause/authority, cancellation, refusal-hold and registry-drop paths. Durable receipts/activity remain the separately tracked integration work.
