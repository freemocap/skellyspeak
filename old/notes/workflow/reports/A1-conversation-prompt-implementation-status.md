# Conversation prompt implementation handoff

September 11, 2026. Base revision: `5e006989a2f5d9376952a3cf55f6d713aee6e9f3`; active uncommitted source is authoritative. No Git writes.

Implemented `src-tauri/src/conversation_prompt.rs` only, with public API `partner_system(&Language, &PracticeSettings, &PartnerDetails) -> Result<String>`. Integration owns module registration/execution wiring and captured template version 3. Reliability owns the five enum variants and Beginner default. No provider, routing, model, store or language configuration edits by AI Operations.

The builder selects exactly one of five trusted instruction blocks. Absolute zero is target-only, using one simple phrase/question and minimal vocabulary and conversational burden. It adds no bilingual cue, reply options, assistance mechanism or extra requests. All levels share one contact contract; selected difficulty is not an assessment or XP award.

Explicit context projection includes target language name/ID, explanation language ID and variety ID. Contact projection includes name, background, tendencies and abstract authored Vibe. Avatar and application controls are excluded. Background stays latent; persona fields remain untrusted data and private coach access is prohibited. Root appends shared writing guidance and captures the prompt on turn acceptance. Existing accepted/in-flight/retry isolation is tested by Integration, not claimed from the module's owned-value test alone.

Validation: all three focused `conversation_prompt::tests` passed; `cargo clippy --manifest-path src-tauri/Cargo.toml --lib --tests -- -D warnings` passed. Tests verify five-level selection, exact context/persona projection, preservation of authored content as data, omission of application/presentation fields, and new prompt construction after profile/context edits. They do not prove live model adherence or language quality. No paid calls or live evaluations performed.

Broader contact lifecycle and navigation remain proposals. Current five-level prompt implementation is complete and ready for independent review and combined application gates.

Source is frozen pending actionable review findings. Integration additionally reports 188 native tests and Clippy passing for combined source; these are Integration results, separate from the focused checks run here. The approved UI is one five-stop difficulty slider.
