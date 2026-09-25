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
