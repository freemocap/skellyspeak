# Native — Rust and Tauri

The application code running on the user's device: persistence, credentials,
AI execution, recording, and native integration. This is separate from the
remote [Python server](../server/).

- `src/`: existing Rust source layout; domain reorganization is the next pass.
- [../content/config/](../content/config/): bundled editable language, construct, starter, and policy defaults.
- [../content/schemas/](../content/schemas/): generated configuration schemas, verified by Rust tests.
- `capabilities/`, `icons/`, Tauri configuration and platform property lists:
  native permissions and packaging.
- `gen/`: platform projects and generated support files; Android customizations
  are tracked, while other generated output follows `.gitignore`.
- `target/`: ignored Cargo build output.

From the repository root:

```sh
npm run tauri -- info
cargo fmt --manifest-path native/Cargo.toml -- --check
cargo clippy --manifest-path native/Cargo.toml --lib --tests -- -D warnings
cargo test --manifest-path native/Cargo.toml --lib
```

The root Tauri launcher selects this directory explicitly. Moving this folder
can invalidate cached build-script paths; `cargo clean --manifest-path native/Cargo.toml`
clears build output without touching source or application data.
