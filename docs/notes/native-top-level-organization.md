# Native top-level organization

Status: implemented after user approval, 2026-09-15. This checkpoint covers the
first level of native source ownership. Deeper subfolders and large-file splitting
remain a separate proposal and approval step.

## Implemented

The maintained folder map is in [native/README.md](../../native/README.md), and
[AGENTS.md](../../AGENTS.md#native-organization) defines placement rules for future
work. The [completed move map](native-top-level-moves.json) records 65 source and
support-file moves.

Native code now belongs to application, conversations, partners, learning, speech,
AI, storage, language, configuration, statistics, diagnostics and updates.
The existing CLI entry points remain in `bin/`. `lib.rs` is a small module index
with the intentional `application::run` export. Its former runtime body moved
intact to `application/mod.rs`. The former `speech.rs` is now `speech/cache.rs`,
avoiding a repeated module name and describing its contents.

Updated Rust imports, module visibility, embedded-file paths, diagnostic log-target
matching, exporter imports, the UI command-registration check, configuration test
filters and current documentation links. Editable defaults stay in root
`content/`, whose AI behavior index now points to the new native paths.

## Scope boundaries

These folders group current responsibilities; they do not establish independent
crates or remove existing cross-domain dependencies. Large modules retain their
current implementations. `model.rs` remains a temporary mixed-type file until an
ownership-based split is agreed. Native packaging stays at the native project root.
Historical notes and archived material were not rewritten.

## Verification

- Full native library suite: 353 passed, 1 ignored. After the cache-module rename,
  both cache tests passed again.
- UI suite: 105 files, 654 tests passed.
- UI production build passed; Vite still reports a bundle-size warning.
- Rust library/test compilation, Clippy with warnings denied, and binary checks passed.
- Configuration filter selects and passes 17 tests; language validation passed.
- Current documentation links passed (9 entry points).
- Move inventory is complete; the command registration list is unchanged; all
  9 moved non-Rust files are byte-identical to their originals.

- Contract exporter check passed with no generated contract changes.
- Desktop executable build passed.

No manual application launch or mobile build is part of this pass. No commits,
version changes, pushes or deployments were performed.
