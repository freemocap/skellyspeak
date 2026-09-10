CREATE TABLE metadata (singleton INTEGER PRIMARY KEY CHECK(singleton=1), revision INTEGER NOT NULL CHECK(revision>=0));
INSERT INTO metadata VALUES(1,0);
CREATE TABLE learner (id TEXT PRIMARY KEY, singleton INTEGER NOT NULL UNIQUE CHECK(singleton=1), name TEXT NOT NULL, revision INTEGER NOT NULL, preferences TEXT NOT NULL CHECK(json_valid(preferences)));
CREATE TABLE language_profiles (id TEXT PRIMARY KEY, learner_id TEXT NOT NULL REFERENCES learner(id) ON DELETE CASCADE, language_id TEXT NOT NULL, UNIQUE(learner_id,language_id));
CREATE TABLE partners (id TEXT PRIMARY KEY, learner_id TEXT NOT NULL REFERENCES learner(id) ON DELETE CASCADE, language_id TEXT NOT NULL, revision INTEGER NOT NULL, details TEXT NOT NULL CHECK(json_valid(details)), UNIQUE(id,learner_id));
CREATE TABLE relationships (id TEXT PRIMARY KEY, learner_id TEXT NOT NULL REFERENCES learner(id) ON DELETE CASCADE, partner_id TEXT NOT NULL UNIQUE, archived INTEGER NOT NULL CHECK(archived IN (0,1)), revision INTEGER NOT NULL, FOREIGN KEY(partner_id,learner_id) REFERENCES partners(id,learner_id) ON DELETE CASCADE);
CREATE TABLE conversations (id TEXT PRIMARY KEY, relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE, language_id TEXT NOT NULL, title TEXT NOT NULL, archived INTEGER NOT NULL CHECK(archived IN (0,1)), revision INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')), last_used INTEGER NOT NULL);
CREATE INDEX conversations_relationship ON conversations(relationship_id,last_used DESC,id);
CREATE TABLE conversation_settings (conversation_id TEXT PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE, revision INTEGER NOT NULL, settings TEXT NOT NULL CHECK(json_valid(settings)));
CREATE TRIGGER conversation_language_insert BEFORE INSERT ON conversations
WHEN NEW.language_id != (SELECT p.language_id FROM relationships r JOIN partners p ON p.id=r.partner_id WHERE r.id=NEW.relationship_id)
BEGIN SELECT RAISE(ABORT,'Conversation language must match partner'); END;
CREATE TRIGGER conversation_language_fixed BEFORE UPDATE OF language_id ON conversations
BEGIN SELECT RAISE(ABORT,'Conversation language is fixed'); END;
CREATE TRIGGER partner_language_fixed BEFORE UPDATE OF language_id ON partners
BEGIN SELECT RAISE(ABORT,'Partner language is fixed'); END;
CREATE TABLE receipts (action_id TEXT PRIMARY KEY, request TEXT NOT NULL, receipt TEXT NOT NULL, partner_id TEXT REFERENCES partners(id) ON DELETE CASCADE, conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE);
PRAGMA application_id=1397443659;
CREATE TABLE credential_cleanup(id TEXT PRIMARY KEY);
CREATE TABLE ai_config(singleton INTEGER PRIMARY KEY CHECK(singleton=1), revision INTEGER NOT NULL, credential_id TEXT, standard_model TEXT NOT NULL, fast_model TEXT NOT NULL, paused INTEGER NOT NULL, route TEXT NOT NULL CHECK(route IN ('hosted','openrouter','custom')), hosted_credential_id TEXT, hosted_email TEXT NOT NULL, groq_credential_id TEXT, custom_credential_id TEXT, custom_config TEXT NOT NULL CHECK(json_valid(custom_config)));
INSERT INTO ai_config VALUES(1,1,NULL,'google/gemini-2.5-flash','google/gemini-2.5-flash-lite',0,'hosted',NULL,'',NULL,NULL,'{"baseUrl":"","standardModel":"","fastModel":"","bearerAuth":false,"transcriptionModel":null}');
CREATE TABLE turns(id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, state TEXT NOT NULL, paused INTEGER NOT NULL, profile_revision INTEGER NOT NULL, credential_id TEXT NOT NULL, route TEXT NOT NULL, model TEXT NOT NULL, context TEXT NOT NULL CHECK(json_valid(context)), created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE UNIQUE INDEX one_pending_reply ON turns(conversation_id) WHERE state='pending';
CREATE TABLE messages(id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, turn_id TEXT NOT NULL REFERENCES turns(id) ON DELETE CASCADE, sequence INTEGER NOT NULL, role TEXT NOT NULL CHECK(role IN ('user','assistant')), text TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')), UNIQUE(conversation_id,sequence), UNIQUE(turn_id,role));
CREATE TABLE operations(id TEXT PRIMARY KEY, turn_id TEXT NOT NULL REFERENCES turns(id) ON DELETE CASCADE, kind TEXT NOT NULL, state TEXT NOT NULL, permit INTEGER NOT NULL DEFAULT 0, UNIQUE(turn_id,kind));
CREATE TABLE attempts(id TEXT PRIMARY KEY, operation_id TEXT NOT NULL REFERENCES operations(id) ON DELETE CASCADE, state TEXT NOT NULL, requested_model TEXT NOT NULL, actual_model TEXT, provider_id TEXT, started_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')), finished_at TEXT, input_tokens INTEGER, output_tokens INTEGER, error TEXT);
PRAGMA user_version=4;
