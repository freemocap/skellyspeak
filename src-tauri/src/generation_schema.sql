-- Generation receipt DDL composed into fresh v13 workspaces.
-- Request/proposal text and credentials never belong in these inference receipts.
CREATE TABLE persona_generation_attempts (
    id TEXT PRIMARY KEY,
    attempt_id TEXT NOT NULL UNIQUE,
    operation_id TEXT NOT NULL UNIQUE,
    language_id TEXT NOT NULL,
    route TEXT NOT NULL CHECK(route IN ('hosted','openrouter','custom')),
    requested_model TEXT NOT NULL,
    profile_revision INTEGER NOT NULL,
    state TEXT NOT NULL CHECK(state IN ('pending','running','succeeded','failed','unknown','cancelled')),
    created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    dispatched_at TEXT,
    finished_at TEXT,
    actual_model TEXT,
    provider_id TEXT,
    input_tokens INTEGER CHECK(input_tokens IS NULL OR input_tokens >= 0),
    output_tokens INTEGER CHECK(output_tokens IS NULL OR output_tokens >= 0),
    error TEXT
);
