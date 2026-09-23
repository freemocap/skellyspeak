//! Request-only persona sampling; the saved profile remains complete.
use crate::model::PersonaDetails;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};

/// Random conversation IDs seed a stable selection for previews, replies and retries.
/// Sample individual data points, not entire lists. Hash ranking avoids new RNG state
/// or persistence; separate domains keep count and item selection independent.
pub(super) fn project(persona: &PersonaDetails, conversation_id: &str) -> Value {
    let mut candidates = Vec::new();
    for (field, values) in [
        ("background", std::slice::from_ref(&persona.background)),
        (
            "current_situation",
            std::slice::from_ref(&persona.current_situation),
        ),
        ("manner", std::slice::from_ref(&persona.manner)),
        ("interests", persona.interests.as_slice()),
        ("opinions", persona.opinions.as_slice()),
        ("interesting_facts", persona.interesting_facts.as_slice()),
        ("favorite_books", persona.favorite_books.as_slice()),
        ("favorite_movies", persona.favorite_movies.as_slice()),
        ("quirks", persona.quirks.as_slice()),
    ] {
        for (index, value) in values.iter().enumerate() {
            if !value.trim().is_empty() {
                let key = format!("persona-detail-v1\0{conversation_id}\0{field}\0{index}");
                candidates.push((Sha256::digest(key.as_bytes()), field, value));
            }
        }
    }
    candidates.sort_by_key(|(rank, _, _)| *rank);
    let count_hash = Sha256::digest(format!("persona-count-v1\0{conversation_id}").as_bytes());
    let count = 1 + u64::from_le_bytes(count_hash[..8].try_into().unwrap()) % 3;
    let mut projection = json!({
        "name": persona.name,
        "location": persona.location,
        "occupation": persona.occupation,
    });
    if let Some(age) = persona.age {
        projection["age"] = json!(age);
    }
    // Romanized names and vibe emoji are display metadata, not descriptive candidates.
    for (_, field, value) in candidates.into_iter().take(count as usize) {
        match field {
            "background" | "current_situation" | "manner" => projection[field] = json!(value),
            _ => {
                let entry = projection
                    .as_object_mut()
                    .unwrap()
                    .entry(field)
                    .or_insert_with(|| json!([]));
                entry.as_array_mut().unwrap().push(json!(value));
            }
        }
    }
    projection
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn samples_individual_details_preserving_identity_source_and_variety() {
        let mut persona = crate::configuration::Registry::bundled()
            .unwrap()
            .starter_persona("spanish")
            .unwrap();
        persona.age = Some(37);
        let original = persona.clone();
        let source = json!(persona);
        let mut selections = std::collections::HashSet::new();
        let mut counts = std::collections::HashSet::new();
        let mut fields = std::collections::HashSet::new();
        for i in 0..200 {
            let key = format!("chat-{i}");
            let selected = project(&persona, &key);
            assert_eq!(selected, project(&persona, &key));
            for field in ["name", "location", "age", "occupation"] {
                assert_eq!(selected[field], source[field]);
            }
            let mut count = 0;
            for (field, value) in selected.as_object().unwrap() {
                if ["name", "location", "age", "occupation"].contains(&field.as_str()) {
                    continue;
                }
                fields.insert(field.clone());
                let source_field = match field.as_str() {
                    "current_situation" => "currentSituation",
                    "interesting_facts" => "interestingFacts",
                    "favorite_books" => "favoriteBooks",
                    "favorite_movies" => "favoriteMovies",
                    other => other,
                };
                if let Some(items) = value.as_array() {
                    for item in items {
                        assert!(source[source_field].as_array().unwrap().contains(item));
                    }
                    assert_eq!(
                        items.iter().collect::<std::collections::HashSet<_>>().len(),
                        items.len()
                    );
                    count += items.len();
                } else {
                    assert_eq!(value, &source[source_field]);
                    count += 1;
                }
            }
            assert!((1..=3).contains(&count));
            counts.insert(count);
            selections.insert(selected.to_string());
        }
        assert_eq!(counts.len(), 3);
        assert!(selections.len() > 20);
        assert_eq!(fields.len(), 9);
        assert_eq!(persona, original);
    }

    #[test]
    fn empty_and_sparse_profiles_only_emit_available_details() {
        let mut persona = crate::configuration::Registry::bundled()
            .unwrap()
            .starter_persona("spanish")
            .unwrap();
        persona.age = None;
        persona.background.clear();
        persona.current_situation = "  ".into();
        persona.manner.clear();
        persona.interests.clear();
        persona.opinions.clear();
        persona.interesting_facts.clear();
        persona.favorite_books.clear();
        persona.favorite_movies.clear();
        persona.quirks.clear();
        assert_eq!(
            project(&persona, "empty"),
            json!({
                "name": persona.name, "location": persona.location, "occupation": persona.occupation,
            })
        );
        persona.quirks.push("源の文字を保持".into());
        for i in 0..20 {
            let selected = project(&persona, &i.to_string());
            assert_eq!(selected["quirks"], json!(persona.quirks));
            assert_eq!(selected.as_object().unwrap().len(), 4);
        }
    }
}
