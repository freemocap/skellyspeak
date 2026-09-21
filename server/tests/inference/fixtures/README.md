# Native decisions contract fixture

`jev-native-request.json` (speech) and `jev-native-text-request.json` are synthetic inputs emitted by the actual Rust turn
admission and dispatch path, using the current criterion catalog. It contains no
user data or credentials. Both native and Python tests assert this same contract.
Regenerate intentionally from the repository root:

```sh
SKELLY_WRITE_JEV_CONTRACT=1 cargo test --manifest-path native/Cargo.toml --lib jev_native_wire_contract_matches_server_fixture
server/.venv/bin/python -m pytest server/tests/inference/test_decisions.py server/tests/inference/test_grouped.py
```

A fixture change must pass both sides. This exists to catch wire mismatches such
as `speech` versus the app's actual `speech_transcript` value.
