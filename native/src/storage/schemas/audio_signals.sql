CREATE TABLE IF NOT EXISTS audio_signals (
 digest TEXT PRIMARY KEY,
 revision INTEGER NOT NULL,
 data BLOB NOT NULL
);
-- References follow the existing byte-retention owners. No second copy of audio.
CREATE TABLE IF NOT EXISTS audio_signal_sources (
 kind TEXT NOT NULL CHECK(kind IN ('inference','recording')),
 id TEXT NOT NULL,
 digest TEXT NOT NULL,
 PRIMARY KEY(kind,id)
);
CREATE INDEX IF NOT EXISTS audio_signal_source_digest ON audio_signal_sources(digest);

-- Content identity of delivered playback survives reusable-result eviction.
CREATE TABLE IF NOT EXISTS delivered_speech (
 attempt_id TEXT PRIMARY KEY REFERENCES attempts(id) ON DELETE CASCADE,
 audio_digest TEXT NOT NULL
);
