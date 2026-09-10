CREATE TABLE transcription_attempts(
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    route TEXT NOT NULL CHECK(route IN ('hosted','openrouter','custom')),
    model TEXT NOT NULL,
    profile_revision INTEGER NOT NULL,
    state TEXT NOT NULL CHECK(state IN ('running','succeeded','failed','unknown')),
    started_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    finished_at TEXT,
    error TEXT
);
CREATE INDEX transcription_conversation ON transcription_attempts(conversation_id);
PRAGMA user_version=7;
