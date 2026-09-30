CREATE TABLE skill_level_events (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT CHECK(sequence BETWEEN 1 AND 4294967295),
    id TEXT NOT NULL UNIQUE,
    learner_id TEXT NOT NULL REFERENCES learner(id) ON DELETE CASCADE,
    language_id TEXT NOT NULL,
    policy_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('skill_level','language_level')),
    skill_id TEXT NOT NULL,
    from_level INTEGER NOT NULL CHECK(from_level>=0),
    to_level INTEGER NOT NULL CHECK(to_level=from_level+1),
    source_attempt_id TEXT,
    chat_id TEXT,
    message_id INTEGER,
    claimed INTEGER NOT NULL DEFAULT 0 CHECK(claimed IN (0,1)),
    CHECK((kind='language_level' AND skill_id='') OR (kind='skill_level' AND length(skill_id)>0)),
    CHECK((source_attempt_id IS NULL AND chat_id IS NULL AND message_id IS NULL) OR
          (source_attempt_id IS NOT NULL AND chat_id IS NOT NULL AND message_id IS NOT NULL)),
    UNIQUE(learner_id,language_id,policy_id,kind,skill_id,to_level)
);
