# rust-schemas

Generated JSON Schema documents serialized as YAML, derived from native Rust authoring types. Do not edit generated schemas by hand. Schemas describe structure; native validation also checks identities, references, variety coverage and release completeness.

Source: `native/src/configuration/authoring/`.

Generate: `cargo run --manifest-path native/Cargo.toml --bin audit-content -- --write-schemas`.

Verify: use the same command with `--check-schemas`.
