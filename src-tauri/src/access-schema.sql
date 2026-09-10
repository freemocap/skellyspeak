-- Extend the active v3 workspace atomically. No archived data is imported.
CREATE TABLE ai_config_next(singleton INTEGER PRIMARY KEY CHECK(singleton=1), revision INTEGER NOT NULL, credential_id TEXT, standard_model TEXT NOT NULL, fast_model TEXT NOT NULL, paused INTEGER NOT NULL, route TEXT NOT NULL CHECK(route IN ('hosted','openrouter','custom')), hosted_credential_id TEXT, hosted_email TEXT NOT NULL, groq_credential_id TEXT, custom_credential_id TEXT, custom_config TEXT NOT NULL CHECK(json_valid(custom_config)));
INSERT INTO ai_config_next SELECT *,NULL,NULL,'{"baseUrl":"","standardModel":"","fastModel":"","bearerAuth":false,"transcriptionModel":null}' FROM ai_config;
DROP TABLE ai_config;
ALTER TABLE ai_config_next RENAME TO ai_config;
PRAGMA user_version=4;

UPDATE ai_config SET revision=revision+1;
UPDATE turns SET state='invalidated' WHERE state='pending';
UPDATE operations SET state='invalidated',permit=0 WHERE state IN ('ready','running','waiting_dependencies');
UPDATE attempts SET state='invalidated',error='AI access profile upgraded; send a new exchange.' WHERE state='running';
