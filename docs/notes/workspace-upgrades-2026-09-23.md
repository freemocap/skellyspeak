# Workspace upgrade proposal — withdrawn

The user rejected this preservation policy on September 23, 2026. Its implementation
has been removed: upgrade runner, frozen old schema, notice ledger/UI, compatibility
steps and related tests. This document is not a specification.

Follow `AGENTS.md`: delete incompatible development data in the smallest practical
scope, without conversion or backwards compatibility. Code/UI changes alone do not
justify a reset. The current workspace format is defined by `SCHEMA_VERSION` in
`native/src/storage/store/schema.rs`, including the stored JSON contracts.
