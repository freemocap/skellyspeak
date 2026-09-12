//! The persona record: the authored personality a contact talks through.
//!
//! Every limit lives here once. The editor's validation and the generation schema
//! both read these constants, so a generated persona can never be shaped
//! differently from an edited one.

use crate::model::{AppError, ErrorCode, PersonaDetails, Result};

pub const NAME_MAX: usize = 80;
pub const AGE_MIN: u8 = 18;
pub const AGE_MAX: u8 = 100;
pub const LOCATION_MAX: usize = 120;
pub const OCCUPATION_MAX: usize = 120;
pub const BACKGROUND_MAX: usize = 2000;
pub const CURRENT_SITUATION_MAX: usize = 600;
pub const MANNER_MAX: usize = 600;
pub const ITEM_MAX: usize = 120;
pub const INTERESTS_MAX: usize = 12;
pub const OPINIONS_MAX: usize = 12;
pub const FACTS_MAX: usize = 12;
pub const BOOKS_MAX: usize = 8;
pub const MOVIES_MAX: usize = 8;
pub const QUIRKS_MAX: usize = 8;
pub const VIBE_MIN: usize = 2;
pub const VIBE_MAX: usize = 4;
pub const BRIEF_MAX: usize = 200;
/// Generated text is never blank; an edited persona may still clear a field that
/// is optional to the conversation.
pub const GENERATED_TEXT_MIN: usize = 1;

fn text(value: &str, label: &str, max: usize, empty: bool) -> Result<()> {
    if (!empty && value.trim().is_empty()) || value.chars().count() > max || value.contains('\0') {
        return Err(AppError::new(
            ErrorCode::Validation,
            format!(
                "{label} must {}be at most {max} characters.",
                if empty { "" } else { "be nonempty and " }
            ),
        ));
    }
    Ok(())
}

/// A short authored list: bounded, nonempty, single-line and distinct.
fn list(values: &[String], label: &str, max: usize) -> Result<()> {
    if values.len() > max {
        return Err(AppError::new(
            ErrorCode::Validation,
            format!("{label} allows at most {max} entries."),
        ));
    }
    for value in values {
        if value.trim().is_empty() {
            return Err(AppError::new(
                ErrorCode::Validation,
                format!("{label} entries cannot be empty."),
            ));
        }
        text(value, label, ITEM_MAX, false)?;
    }
    let mut unique = values.to_vec();
    unique.sort();
    unique.dedup();
    if unique.len() != values.len() {
        return Err(AppError::new(
            ErrorCode::Validation,
            format!("{label} entries must be distinct."),
        ));
    }
    Ok(())
}

/// Validate a persona for the language it speaks. A language written in a
/// non-Latin script has a romanization system, and its personas carry their name
/// in Latin letters; every other language's personas carry none.
pub fn validate(details: &PersonaDetails, language_id: &str) -> Result<()> {
    let romanized = crate::languages::language(language_id)?
        .romanization
        .is_some();
    text(&details.name, "Name", NAME_MAX, false)?;
    match (&details.romanized_name, romanized) {
        (Some(name), true) => text(name, "Romanized name", NAME_MAX, false)?,
        (None, false) => {}
        (None, true) => {
            return Err(AppError::new(
                ErrorCode::Validation,
                "Romanized name is required for this language.",
            ));
        }
        (Some(_), false) => {
            return Err(AppError::new(
                ErrorCode::Validation,
                "Romanized name is only used for languages written in a non-Latin script.",
            ));
        }
    }
    if details
        .age
        .is_some_and(|age| !(AGE_MIN..=AGE_MAX).contains(&age))
    {
        return Err(AppError::new(
            ErrorCode::Validation,
            format!("Age must be blank or a whole number between {AGE_MIN} and {AGE_MAX}."),
        ));
    }
    text(&details.location, "Location", LOCATION_MAX, true)?;
    text(&details.occupation, "Occupation", OCCUPATION_MAX, true)?;
    text(&details.background, "Background", BACKGROUND_MAX, true)?;
    text(
        &details.current_situation,
        "Current situation",
        CURRENT_SITUATION_MAX,
        true,
    )?;
    text(&details.manner, "Manner", MANNER_MAX, true)?;
    list(&details.interests, "Interests", INTERESTS_MAX)?;
    list(&details.opinions, "Opinions", OPINIONS_MAX)?;
    list(&details.interesting_facts, "Interesting facts", FACTS_MAX)?;
    list(&details.favorite_books, "Favorite books", BOOKS_MAX)?;
    list(&details.favorite_movies, "Favorite movies", MOVIES_MAX)?;
    list(&details.quirks, "Quirks", QUIRKS_MAX)?;
    if !(VIBE_MIN..=VIBE_MAX).contains(&details.vibe.len()) {
        return Err(AppError::new(
            ErrorCode::Validation,
            format!("Vibe needs between {VIBE_MIN} and {VIBE_MAX} emoji."),
        ));
    }
    for symbol in &details.vibe {
        if !crate::emoji::is_emoji(symbol) {
            return Err(AppError::new(
                ErrorCode::Validation,
                format!("Each Vibe entry must be one emoji. {symbol} is not an emoji."),
            ));
        }
    }
    let mut unique = details.vibe.clone();
    unique.sort();
    unique.dedup();
    if unique.len() != details.vibe.len() {
        return Err(AppError::new(
            ErrorCode::Validation,
            "Vibe symbols must be distinct.",
        ));
    }
    Ok(())
}

/// The strict object a generation request must return, derived from the same
/// limits the editor enforces. The romanized name is nullable here; `validate`
/// decides from the language whether it must be present.
pub fn output_schema() -> serde_json::Value {
    let text = |max: usize| serde_json::json!({ "type": "string", "minLength": GENERATED_TEXT_MIN, "maxLength": max });
    let items = |max: usize| {
        serde_json::json!({
            "type": "array",
            "minItems": 1,
            "maxItems": max,
            "uniqueItems": true,
            "items": { "type": "string", "minLength": GENERATED_TEXT_MIN, "maxLength": ITEM_MAX }
        })
    };
    serde_json::json!({
        "type": "object",
        "additionalProperties": false,
        "required": ["name", "romanizedName", "age", "location", "occupation", "background", "currentSituation", "interests", "opinions", "interestingFacts", "favoriteBooks", "favoriteMovies", "manner", "quirks", "vibe"],
        "properties": {
            "name": text(NAME_MAX),
            "romanizedName": { "type": ["string", "null"], "minLength": GENERATED_TEXT_MIN, "maxLength": NAME_MAX },
            "age": { "type": ["integer", "null"], "minimum": AGE_MIN, "maximum": AGE_MAX },
            "location": text(LOCATION_MAX),
            "occupation": text(OCCUPATION_MAX),
            "background": text(BACKGROUND_MAX),
            "currentSituation": text(CURRENT_SITUATION_MAX),
            "interests": items(INTERESTS_MAX),
            "opinions": items(OPINIONS_MAX),
            "interestingFacts": items(FACTS_MAX),
            "favoriteBooks": items(BOOKS_MAX),
            "favoriteMovies": items(MOVIES_MAX),
            "manner": text(MANNER_MAX),
            "quirks": items(QUIRKS_MAX),
            "vibe": {
                "type": "array",
                "minItems": VIBE_MIN,
                "maxItems": VIBE_MAX,
                "uniqueItems": true,
                "items": { "type": "string", "minLength": GENERATED_TEXT_MIN }
            }
        }
    })
}

/// The persona a language starts with. Hand-written, one per language, and never
/// the product of an AI call: first launch must reach a usable chat before any
/// route is configured. Every language in the registry is covered by the test
/// below rather than by a panic.
pub fn starter(language_id: &str) -> Result<PersonaDetails> {
    let details = match language_id {
        "es" => PersonaDetails {
            name: "Lucía".into(),
            romanized_name: None,
            age: Some(34),
            location: "Valencia, Spain".into(),
            occupation: "Veterinary nurse at a small animal clinic".into(),
            background: "Grew up in a village outside Teruel and moved to Valencia for work. Shares a flat with her sister and a very loud cat named Trufa.".into(),
            current_situation: "Her sister's wedding is in three weeks and Lucía is in charge of the playlist. She is also trying to finish a pottery course before it ends.".into(),
            interests: vec!["balcony vegetable garden".into(), "swimming in the sea before work".into(), "detective novels".into(), "second-hand markets".into()],
            opinions: vec!["Paella should never contain chorizo.".into(), "The beach is better in winter.".into(), "Breakfast is the best meal of the day.".into()],
            interesting_facts: vec!["Can name every tree on her street.".into(), "Once cycled from Valencia to Sagunto on a dare.".into()],
            favorite_books: vec!["La sombra del viento — Carlos Ruiz Zafón".into(), "Nada — Carmen Laforet".into()],
            favorite_movies: vec!["Volver (2006)".into(), "Mar adentro (2004)".into()],
            manner: "Warm and quick. Short sentences, plenty of questions, and gentle teasing once she is comfortable.".into(),
            quirks: vec!["Describes food by its smell.".into(), "Sends voice notes instead of writing.".into()],
            vibe: vec!["🌿".into(), "🌊".into(), "🍊".into()],
        },
        "fr" => PersonaDetails {
            name: "Camille".into(),
            romanized_name: None,
            age: Some(41),
            location: "Lyon, France".into(),
            occupation: "Runs a small bookshop that hosts evening readings".into(),
            background: "Grew up in Nantes, studied history, and took over the bookshop from a retiring neighbour. Lives in the flat above it.".into(),
            current_situation: "Preparing a reading night for a local author and arguing with a printer about the posters.".into(),
            interests: vec!["bookbinding".into(), "long train journeys".into(), "cooking for too many people".into(), "documentaries about mountains".into()],
            opinions: vec!["E-readers are fine and paper is better.".into(), "Anyone who dislikes soup is not to be trusted.".into()],
            interesting_facts: vec!["Keeps a notebook of sentences overheard on the tram.".into(), "Has read the same novel every winter for ten years.".into()],
            favorite_books: vec!["L'Étranger — Albert Camus".into(), "Les Misérables — Victor Hugo".into()],
            favorite_movies: vec!["Amélie (2001)".into(), "Les Quatre Cents Coups (1959)".into()],
            manner: "Measured and precise. Enjoys a well-argued disagreement and rarely uses exclamation marks.".into(),
            quirks: vec!["Quotes a line from whatever she is currently reading.".into()],
            vibe: vec!["📚".into(), "☕".into(), "🌧️".into()],
        },
        "ar" => PersonaDetails {
            name: "نور".into(),
            romanized_name: Some("Nūr".into()),
            age: Some(29),
            location: "Amman, Jordan".into(),
            occupation: "Architect at a firm that restores old buildings".into(),
            background: "Studied in Amman and spent a year in Tunis. Lives with her grandmother, who does most of the cooking and all of the opinions.".into(),
            current_situation: "Documenting a 1930s house before it is renovated, and learning to make her grandmother's maqluba.".into(),
            interests: vec!["sketching doorways".into(), "old maps".into(), "oud music".into(), "walking the same hill every Friday".into()],
            opinions: vec!["New buildings should be shorter.".into(), "Mint belongs in almost everything.".into()],
            interesting_facts: vec!["Can read the decade a building was built from its stonework.".into()],
            favorite_books: vec!["Season of Migration to the North — Tayeb Salih".into(), "The Cairo Trilogy — Naguib Mahfouz".into()],
            favorite_movies: vec!["Theeb (2014)".into(), "Cairo Station (1958)".into()],
            manner: "Curious and direct. Asks precise questions and laughs easily.".into(),
            quirks: vec!["Photographs doors wherever she goes.".into()],
            vibe: vec!["🏛️".into(), "🎻".into(), "🌿".into()],
        },
        "zh" => PersonaDetails {
            name: "小林".into(),
            romanized_name: Some("Xiǎo Lín".into()),
            age: Some(26),
            location: "Chengdu, China".into(),
            occupation: "Bike courier saving up for a tea shop".into(),
            background: "Moved to Chengdu from a small town in Yunnan. Shares a flat with two friends and far too many plants.".into(),
            current_situation: "Saving money, learning to brew pu'er properly, and training for a hundred-kilometre ride.".into(),
            interests: vec!["night rides through the city".into(), "street food".into(), "tea".into(), "cheap science-fiction paperbacks".into()],
            opinions: vec!["The best food is always in the least attractive shop.".into(), "Mornings should start later.".into()],
            interesting_facts: vec!["Knows the steepest street in every district.".into(), "Can fix a flat tyre in four minutes.".into()],
            favorite_books: vec!["The Three-Body Problem — Liu Cixin".into(), "To Live — Yu Hua".into()],
            favorite_movies: vec!["Spirited Away (2001)".into(), "In the Mood for Love (2000)".into()],
            manner: "Relaxed and funny. Short replies, and often steers the subject back to food.".into(),
            quirks: vec!["Rates every meal out of ten.".into()],
            vibe: vec!["🚲".into(), "🍜".into(), "🍃".into()],
        },
        "en" => PersonaDetails {
            name: "Rowan".into(),
            romanized_name: None,
            age: Some(38),
            location: "Bristol, England".into(),
            occupation: "Sound engineer for a small theatre".into(),
            background: "Grew up on the coast, moved inland for work, and has been meaning to move back for eleven years.".into(),
            current_situation: "Tech week for a play that opens on Friday, so sleeping badly and drinking too much coffee.".into(),
            interests: vec!["repairing old radios".into(), "cold water swimming".into(), "folk music".into(), "cooking one ambitious dish a month".into()],
            opinions: vec!["Interval ice cream is the best part of theatre.".into(), "A recipe that forbids substitutions is a recipe not worth following.".into()],
            interesting_facts: vec!["Can judge a room's size from a single hand clap.".into()],
            favorite_books: vec!["The Rings of Saturn — W. G. Sebald".into(), "Cider with Rosie — Laurie Lee".into()],
            favorite_movies: vec!["The Conversation (1974)".into(), "Local Hero (1983)".into()],
            manner: "Dry and understated. Explains things with comparisons rather than adjectives.".into(),
            quirks: vec!["Hums without noticing.".into()],
            vibe: vec!["🎧".into(), "🌊".into(), "🛠️".into()],
        },
        _ => {
            return Err(AppError::new(
                ErrorCode::Validation,
                "This language has no starter persona.",
            ));
        }
    };
    validate(&details, language_id)?;
    Ok(details)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_registered_language_has_a_starter_persona_that_validates() {
        let registry = crate::languages::registry();
        assert!(!registry.is_empty());
        for language in registry {
            let details = starter(&language.id)
                .unwrap_or_else(|error| panic!("{} has no starter persona: {error}", language.id));
            validate(&details, &language.id).unwrap();
            assert_eq!(details.vibe.len(), VIBE_MIN + 1);
            assert_eq!(
                details.romanized_name.is_some(),
                language.romanization.is_some()
            );
        }
        assert_eq!(starter("xx").unwrap_err().code, ErrorCode::Validation);
    }

    #[test]
    fn a_romanized_name_is_required_exactly_for_non_latin_languages() {
        let mut chinese = starter("zh").unwrap();
        chinese.romanized_name = None;
        assert_eq!(
            validate(&chinese, "zh").unwrap_err().code,
            ErrorCode::Validation
        );
        chinese.romanized_name = Some("  ".into());
        assert_eq!(
            validate(&chinese, "zh").unwrap_err().code,
            ErrorCode::Validation
        );
        let mut spanish = starter("es").unwrap();
        spanish.romanized_name = Some("Lucia".into());
        assert_eq!(
            validate(&spanish, "es").unwrap_err().code,
            ErrorCode::Validation
        );
    }

    #[test]
    fn limits_are_enforced_at_their_boundaries() {
        let base = starter("es").unwrap();
        let with = |edit: &dyn Fn(&mut PersonaDetails)| {
            let mut details = base.clone();
            edit(&mut details);
            details
        };
        assert!(validate(&base, "es").is_ok());
        assert!(
            validate(&with(&|d| d.age = None), "es").is_ok(),
            "a blank age is allowed"
        );
        for (label, details) in [
            ("short age", with(&|d| d.age = Some(AGE_MIN - 1))),
            ("long age", with(&|d| d.age = Some(AGE_MAX + 1))),
            (
                "too many books",
                with(&|d| d.favorite_books = (0..=BOOKS_MAX).map(|n| format!("b{n}")).collect()),
            ),
            ("blank name", with(&|d| d.name = "   ".into())),
            ("long name", with(&|d| d.name = "n".repeat(NAME_MAX + 1))),
            (
                "long item",
                with(&|d| d.interests = vec!["i".repeat(ITEM_MAX + 1)]),
            ),
            (
                "too many interests",
                with(&|d| d.interests = (0..=INTERESTS_MAX).map(|n| format!("i{n}")).collect()),
            ),
            (
                "repeated interest",
                with(&|d| d.interests = vec!["x".into(), "x".into()]),
            ),
            ("single emoji vibe", with(&|d| d.vibe = vec!["🌿".into()])),
            (
                "too many vibe",
                with(&|d| {
                    d.vibe = vec![
                        "🌿".into(),
                        "🌊".into(),
                        "🍊".into(),
                        "🎵".into(),
                        "📚".into(),
                    ]
                }),
            ),
            (
                "text in vibe",
                with(&|d| d.vibe = vec!["🌿".into(), "no".into()]),
            ),
            (
                "repeated vibe",
                with(&|d| d.vibe = vec!["🌿".into(), "🌿".into()]),
            ),
        ] {
            assert_eq!(
                validate(&details, "es").unwrap_err().code,
                ErrorCode::Validation,
                "{label} should be refused"
            );
        }
    }

    #[test]
    fn the_generation_schema_is_built_from_the_same_limits() {
        let schema = output_schema();
        let properties = &schema["properties"];
        assert_eq!(properties["name"]["maxLength"], NAME_MAX);
        assert_eq!(properties["romanizedName"]["maxLength"], NAME_MAX);
        assert_eq!(properties["age"]["minimum"], AGE_MIN);
        assert_eq!(properties["age"]["maximum"], AGE_MAX);
        assert_eq!(properties["interests"]["maxItems"], INTERESTS_MAX);
        assert_eq!(properties["interests"]["items"]["maxLength"], ITEM_MAX);
        assert_eq!(properties["interests"]["uniqueItems"], true);
        assert_eq!(properties["quirks"]["maxItems"], QUIRKS_MAX);
        assert_eq!(properties["favoriteBooks"]["maxItems"], BOOKS_MAX);
        assert_eq!(properties["favoriteMovies"]["maxItems"], MOVIES_MAX);
        assert_eq!(properties["vibe"]["minItems"], VIBE_MIN);
        assert_eq!(properties["vibe"]["maxItems"], VIBE_MAX);
        assert_eq!(schema["additionalProperties"], false);
        assert_eq!(
            schema["required"].as_array().unwrap().len(),
            properties.as_object().unwrap().len()
        );
    }
}
