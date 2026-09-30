CREATE TABLE IF NOT EXISTS skill_choices(language_id TEXT PRIMARY KEY,revision INTEGER NOT NULL,focus TEXT,excluded TEXT NOT NULL CHECK(json_valid(excluded)));
CREATE TABLE IF NOT EXISTS reward_settings(singleton INTEGER PRIMARY KEY CHECK(singleton=1), settings TEXT NOT NULL CHECK(json_valid(settings)));
INSERT OR IGNORE INTO reward_settings VALUES(1,'{"revision":0,"fastMode":true,"rewardSounds":"follow_tts","masterVolume":100,"voiceVolume":100,"effectsVolume":20}');
CREATE TABLE IF NOT EXISTS voice_playback(singleton INTEGER PRIMARY KEY CHECK(singleton=1),rate REAL NOT NULL CHECK(rate BETWEEN 0.5 AND 1.5));
INSERT OR IGNORE INTO voice_playback VALUES(1,1.0);
CREATE TABLE IF NOT EXISTS microphone_selection(singleton INTEGER PRIMARY KEY CHECK(singleton=1), device TEXT CHECK(device IS NULL OR length(device) BETWEEN 1 AND 512));
INSERT OR IGNORE INTO microphone_selection VALUES(1,NULL);
