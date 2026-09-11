ALTER TABLE turns ADD COLUMN refusal_hold TEXT
    CHECK(refusal_hold IS NULL OR json_valid(refusal_hold));
PRAGMA user_version=5;
