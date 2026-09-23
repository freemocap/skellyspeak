-- Current v18 core schema; generation_schema.sql adds current receipt tables.
CREATE TABLE metadata (singleton INTEGER PRIMARY KEY CHECK(singleton=1), revision INTEGER NOT NULL CHECK(revision>=0));
INSERT INTO metadata VALUES(1,0);
CREATE TABLE learner (id TEXT PRIMARY KEY, singleton INTEGER NOT NULL UNIQUE CHECK(singleton=1), name TEXT NOT NULL, revision INTEGER NOT NULL, preferences TEXT NOT NULL CHECK(json_valid(preferences)));
CREATE TABLE language_profiles (id TEXT PRIMARY KEY, learner_id TEXT NOT NULL REFERENCES learner(id) ON DELETE CASCADE, language_id TEXT NOT NULL, UNIQUE(learner_id,language_id));
CREATE TABLE personas (id TEXT PRIMARY KEY, learner_id TEXT NOT NULL REFERENCES learner(id) ON DELETE CASCADE, language_id TEXT NOT NULL, revision INTEGER NOT NULL, details TEXT NOT NULL CHECK(json_valid(details)), UNIQUE(id,learner_id));
CREATE TABLE contacts (id TEXT PRIMARY KEY, learner_id TEXT NOT NULL REFERENCES learner(id) ON DELETE CASCADE, persona_id TEXT NOT NULL UNIQUE, archived INTEGER NOT NULL CHECK(archived IN (0,1)), revision INTEGER NOT NULL, FOREIGN KEY(persona_id,learner_id) REFERENCES personas(id,learner_id) ON DELETE CASCADE);
CREATE TABLE conversations (id TEXT PRIMARY KEY, contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE, language_id TEXT NOT NULL, title TEXT NOT NULL, archived INTEGER NOT NULL CHECK(archived IN (0,1)), revision INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')), last_used INTEGER NOT NULL);
CREATE INDEX conversations_contact ON conversations(contact_id,last_used DESC,id);
CREATE TABLE conversation_settings (conversation_id TEXT PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE, revision INTEGER NOT NULL, settings TEXT NOT NULL CHECK(json_valid(settings)));
CREATE TRIGGER conversation_language_insert BEFORE INSERT ON conversations
WHEN NEW.language_id != (SELECT p.language_id FROM contacts c JOIN personas p ON p.id=c.persona_id WHERE c.id=NEW.contact_id)
BEGIN SELECT RAISE(ABORT,'Conversation language must match persona'); END;
CREATE TRIGGER conversation_language_fixed BEFORE UPDATE OF language_id ON conversations
BEGIN SELECT RAISE(ABORT,'Conversation language is fixed'); END;
CREATE TRIGGER persona_language_fixed BEFORE UPDATE OF language_id ON personas
BEGIN SELECT RAISE(ABORT,'Persona language is fixed'); END;
CREATE TABLE receipts (action_id TEXT PRIMARY KEY, request TEXT NOT NULL, receipt TEXT NOT NULL, persona_id TEXT REFERENCES personas(id) ON DELETE CASCADE, conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE);
PRAGMA application_id=1397443659;
CREATE TABLE credential_cleanup(id TEXT PRIMARY KEY);
CREATE TABLE ai_config(singleton INTEGER PRIMARY KEY CHECK(singleton=1), revision INTEGER NOT NULL, credential_id TEXT, standard_model TEXT NOT NULL, fast_model TEXT NOT NULL, audio_settings TEXT NOT NULL CHECK(json_valid(audio_settings)), paused INTEGER NOT NULL, route TEXT NOT NULL CHECK(route IN ('hosted','openrouter','custom')), hosted_credential_id TEXT, hosted_email TEXT NOT NULL, groq_credential_id TEXT, elevenlabs_credential_id TEXT, custom_credential_id TEXT, custom_config TEXT NOT NULL CHECK(json_valid(custom_config)), assessment_adapter TEXT NOT NULL CHECK(assessment_adapter IN ('jev_choice','chat_model')));
INSERT INTO ai_config VALUES(1,1,NULL,'google/gemini-2.5-flash','google/gemini-2.5-flash-lite','{"transcription":{"model":"whisper-large-v3"},"speech":{"model":"eleven_v3"}}',0,'hosted',NULL,'',NULL,NULL,NULL,'{"baseUrl":"http://127.0.0.1:8765/v1","bearerAuth":true}','chat_model');
CREATE TABLE turns(id TEXT PRIMARY KEY, replaces_turn_id TEXT UNIQUE REFERENCES turns(id) ON DELETE CASCADE, refusal_hold TEXT CHECK(refusal_hold IS NULL OR json_valid(refusal_hold)), conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, state TEXT NOT NULL, paused INTEGER NOT NULL, profile_revision INTEGER NOT NULL, credential_id TEXT NOT NULL, route TEXT NOT NULL, model TEXT NOT NULL, context TEXT NOT NULL CHECK(json_valid(context)), created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX turns_conversation ON turns(conversation_id);
CREATE UNIQUE INDEX one_pending_reply ON turns(conversation_id) WHERE state='pending';
CREATE TABLE messages(id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, turn_id TEXT NOT NULL REFERENCES turns(id) ON DELETE CASCADE, sequence INTEGER NOT NULL, role TEXT NOT NULL CHECK(role IN ('user','assistant')), text TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')), UNIQUE(conversation_id,sequence), UNIQUE(turn_id,role));
CREATE TABLE operations(id TEXT PRIMARY KEY, turn_id TEXT NOT NULL REFERENCES turns(id) ON DELETE CASCADE, kind TEXT NOT NULL, state TEXT NOT NULL, permit INTEGER NOT NULL DEFAULT 0, UNIQUE(turn_id,kind));
CREATE TABLE attempts(id TEXT PRIMARY KEY, operation_id TEXT NOT NULL REFERENCES operations(id) ON DELETE CASCADE, state TEXT NOT NULL, requested_model TEXT NOT NULL, actual_model TEXT, provider_id TEXT, started_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')), finished_at TEXT, input_tokens INTEGER, output_tokens INTEGER, error TEXT, diagnostics TEXT CHECK(diagnostics IS NULL OR json_valid(diagnostics)), request_messages TEXT CHECK(request_messages IS NULL OR json_valid(request_messages)), response_text TEXT CHECK(response_text IS NULL OR length(CAST(response_text AS BLOB))<=262144), preview_text TEXT CHECK(preview_text IS NULL OR length(CAST(preview_text AS BLOB))<=262144));
CREATE TABLE inference_holds(id TEXT PRIMARY KEY, generation TEXT NOT NULL, route TEXT NOT NULL CHECK(route IN ('hosted','openrouter','custom')), error TEXT NOT NULL CHECK(json_valid(error)));
-- One drill item is a target-language line the learner practises saying. Sets,
-- sessions and visits arrive with Drill itself; an item is what a recording can
-- belong to today.
CREATE TABLE drill_items(id TEXT PRIMARY KEY, source TEXT NOT NULL DEFAULT '{"kind":"own"}' CHECK(json_valid(source)), language_id TEXT NOT NULL, variety_id TEXT NOT NULL, explanation_language TEXT NOT NULL, explanation_variety_id TEXT NOT NULL, text TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)), created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')));
-- Manual Drill sessions are scoped to a practice language until sets exist.
CREATE TABLE drill_sessions(id TEXT PRIMARY KEY, language_id TEXT NOT NULL, started_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')), ended_at TEXT, end_reason TEXT CHECK(end_reason IS NULL OR end_reason IN ('left','replaced','interrupted')));
CREATE UNIQUE INDEX drill_session_active ON drill_sessions((1)) WHERE ended_at IS NULL;
CREATE TABLE drill_visits(id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES drill_sessions(id) ON DELETE CASCADE, drill_item_id TEXT NOT NULL REFERENCES drill_items(id) ON DELETE CASCADE, entered_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')), left_at TEXT);
CREATE UNIQUE INDEX drill_visit_active ON drill_visits(session_id) WHERE left_at IS NULL;
-- A recording belongs to exactly one owner: a conversation or a drill item.
CREATE TABLE transcription_attempts(id TEXT PRIMARY KEY, conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE, drill_item_id TEXT REFERENCES drill_items(id) ON DELETE CASCADE, drill_visit_id TEXT REFERENCES drill_visits(id) ON DELETE SET NULL, route TEXT NOT NULL CHECK(route IN ('hosted','openrouter','custom')), model TEXT NOT NULL, profile_revision INTEGER NOT NULL, state TEXT NOT NULL CHECK(state IN ('running','succeeded','failed','unknown')), started_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')), finished_at TEXT, error TEXT, diagnostics TEXT CHECK(diagnostics IS NULL OR json_valid(diagnostics)), CHECK((conversation_id IS NULL)!=(drill_item_id IS NULL)));
CREATE INDEX transcription_conversation ON transcription_attempts(conversation_id);
CREATE INDEX transcription_drill_item ON transcription_attempts(drill_item_id);
-- One recorded attempt at a drill item. The provider receipt lives in
-- transcription_attempts; this row holds what Drill itself owns: the transcript
-- it compared, the comparison result, and where the audio is until it is pruned.
CREATE TABLE drill_attempts(id TEXT PRIMARY KEY, drill_item_id TEXT NOT NULL REFERENCES drill_items(id) ON DELETE CASCADE, transcription_attempt_id TEXT REFERENCES transcription_attempts(id) ON DELETE SET NULL, visit_id TEXT REFERENCES drill_visits(id) ON DELETE SET NULL, sequence INTEGER NOT NULL, transcript TEXT NOT NULL, comparison TEXT NOT NULL CHECK(json_valid(comparison)), audio_bytes INTEGER, pending_audio BLOB, audio_pruned_at TEXT, created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')), UNIQUE(drill_item_id,sequence));
CREATE INDEX drill_attempts_visit ON drill_attempts(visit_id);
CREATE INDEX drill_attempts_item ON drill_attempts(drill_item_id,sequence);
-- One attempt per recording: a retried save cannot store the same utterance twice.
CREATE UNIQUE INDEX drill_attempts_recording ON drill_attempts(transcription_attempt_id) WHERE transcription_attempt_id IS NOT NULL;
-- Regenerable reference audio, bounded separately from learner recordings.
CREATE TABLE drill_references(drill_item_id TEXT PRIMARY KEY REFERENCES drill_items(id) ON DELETE CASCADE, cache_key TEXT NOT NULL, audio BLOB NOT NULL, receipt_id TEXT NOT NULL REFERENCES reading_attempts(id), last_used INTEGER NOT NULL);
CREATE TABLE drill_storage(id INTEGER PRIMARY KEY CHECK(id=1), limit_mb INTEGER NOT NULL CHECK(limit_mb BETWEEN 0 AND 100000));
INSERT INTO drill_storage(id,limit_mb) VALUES(1,500);
CREATE TABLE drill_previews(id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('generated','conversation')), input TEXT NOT NULL CHECK(json_valid(input)), receipt_id TEXT REFERENCES generation_attempts(id), ready INTEGER NOT NULL DEFAULT 0, expires_at TEXT NOT NULL DEFAULT(datetime('now','+1 day')));
CREATE TABLE drill_candidates(id TEXT PRIMARY KEY, preview_id TEXT NOT NULL REFERENCES drill_previews(id) ON DELETE CASCADE, ordinal INTEGER NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), accepted_item_id TEXT, UNIQUE(preview_id,ordinal));
PRAGMA user_version=37;

CREATE TRIGGER revision_link_insert BEFORE INSERT ON turns WHEN NEW.replaces_turn_id IS NOT NULL AND (NEW.replaces_turn_id=NEW.id OR NOT EXISTS(SELECT 1 FROM turns WHERE id=NEW.replaces_turn_id AND conversation_id=NEW.conversation_id)) BEGIN SELECT RAISE(ABORT,'Invalid revision ownership'); END;
CREATE TRIGGER revision_link_update BEFORE UPDATE OF replaces_turn_id ON turns WHEN OLD.replaces_turn_id IS NOT NULL OR NEW.replaces_turn_id=NEW.id OR (NEW.replaces_turn_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM turns WHERE id=NEW.replaces_turn_id AND conversation_id=NEW.conversation_id AND rowid<OLD.rowid)) BEGIN SELECT RAISE(ABORT,'Invalid revision chain'); END;

CREATE TABLE conversation_openings(conversation_id TEXT PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,opening TEXT NOT NULL CHECK(json_valid(opening)),turn_id TEXT REFERENCES turns(id) ON DELETE CASCADE,created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')));

CREATE TABLE saved_topics (id TEXT PRIMARY KEY, text TEXT NOT NULL UNIQUE);

-- Reading source and audio remain volatile; receipts contain redacted metadata only.
CREATE TABLE reading_attempts (id TEXT PRIMARY KEY, receipt TEXT NOT NULL CHECK(json_valid(receipt)));
