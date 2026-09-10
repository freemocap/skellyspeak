CREATE TABLE inference_holds(
    id TEXT PRIMARY KEY,
    generation TEXT NOT NULL,
    route TEXT NOT NULL CHECK(route IN ('hosted','openrouter','custom')),
    error TEXT NOT NULL CHECK(json_valid(error))
);
PRAGMA user_version=6;
