CREATE TABLE reading_packages (
 id TEXT PRIMARY KEY,
 version TEXT NOT NULL,
 digest TEXT NOT NULL,
 license TEXT NOT NULL,
 review TEXT NOT NULL CHECK(review = 'source_checked')
);
CREATE TABLE reading_dictionary (
 package_id TEXT NOT NULL REFERENCES reading_packages(id) ON DELETE CASCADE,
 id TEXT NOT NULL,
 language TEXT NOT NULL,
 variety TEXT NOT NULL,
 explanation TEXT NOT NULL,
 explanation_variety TEXT NOT NULL,
 surface TEXT NOT NULL,
 payload TEXT NOT NULL CHECK(json_valid(payload)),
 PRIMARY KEY(package_id,id)
);
CREATE INDEX reading_dictionary_scope_surface ON reading_dictionary(language,variety,explanation,explanation_variety,surface);
