-- Frozen optional startup tables from version 45. Do not edit after release.
CREATE TABLE IF NOT EXISTS skill_choices(language_id TEXT PRIMARY KEY,revision INTEGER NOT NULL,focus TEXT,excluded TEXT NOT NULL CHECK(json_valid(excluded)));
CREATE TABLE IF NOT EXISTS reward_settings(singleton INTEGER PRIMARY KEY CHECK(singleton=1), settings TEXT NOT NULL CHECK(json_valid(settings)));
INSERT OR IGNORE INTO reward_settings VALUES(1,'{"revision":0,"fastMode":true,"rewardSounds":"follow_tts","masterVolume":100,"voiceVolume":100,"effectsVolume":20}');
CREATE TABLE IF NOT EXISTS voice_playback(singleton INTEGER PRIMARY KEY CHECK(singleton=1),rate REAL NOT NULL CHECK(rate BETWEEN 0.5 AND 1.5));
INSERT OR IGNORE INTO voice_playback VALUES(1,1.0);
CREATE TABLE IF NOT EXISTS microphone_selection(singleton INTEGER PRIMARY KEY CHECK(singleton=1), device TEXT CHECK(device IS NULL OR length(device) BETWEEN 1 AND 512));
INSERT OR IGNORE INTO microphone_selection VALUES(1,NULL);
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

CREATE TABLE IF NOT EXISTS inference_cache_settings (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 capacity_bytes INTEGER NOT NULL CHECK(capacity_bytes BETWEEN 0 AND 104857600000),
 clock INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO inference_cache_settings(singleton,capacity_bytes) VALUES(1,268435456);
-- Content-free execution provenance survives payload eviction.
CREATE TABLE IF NOT EXISTS inference_executions (
 id TEXT PRIMARY KEY, task TEXT NOT NULL, state TEXT NOT NULL,
 dispatched INTEGER NOT NULL DEFAULT 0 CHECK(dispatched IN (0,1)),
 metadata TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(metadata)),
 created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 finished_at TEXT
);
CREATE TABLE IF NOT EXISTS inference_blobs (
 digest TEXT PRIMARY KEY, payload BLOB NOT NULL CHECK(length(payload)>0)
);
CREATE TABLE IF NOT EXISTS inference_results (
 id TEXT PRIMARY KEY REFERENCES inference_executions(id),
 request_key TEXT NOT NULL, blob_digest TEXT NOT NULL REFERENCES inference_blobs(digest),
 last_used INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS inference_result_request ON inference_results(request_key,last_used);
CREATE INDEX IF NOT EXISTS inference_result_recency ON inference_results(last_used,id);
-- Opaque receipt associations; publication authority stays with each consumer.
CREATE TABLE IF NOT EXISTS inference_consumers (
 consumer_id TEXT PRIMARY KEY, execution_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recording_results(recording_id TEXT PRIMARY KEY REFERENCES transcription_attempts(id) ON DELETE CASCADE, audio_digest TEXT NOT NULL, result TEXT NOT NULL CHECK(json_valid(result)));
