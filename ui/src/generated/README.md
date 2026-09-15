# Generated UI contracts and catalog

Rust owns these files. From the repository root, run `npm run contracts` to
regenerate them or `npm run contracts:check` to verify they match the Rust source.

- `contracts.ts`: TypeScript declarations and constants exported by the native model.
- `skill-catalogs/catalog.json`: the native coaching construct catalog used by UI fixtures.

Do not edit these outputs directly. The exporter is
[native/src/bin/export-contracts.rs](../../../../native/src/bin/export-contracts.rs).
