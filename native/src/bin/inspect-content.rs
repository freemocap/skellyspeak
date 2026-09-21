//! Repository inspection uses the same parser, validator and resolver as the app.
use skellyspeak_core::configuration::Registry;
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let registry =
        Registry::load(&std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../content"))?;
    if args.as_slice() == ["--catalog"] {
        println!("{}", serde_json::to_string_pretty(&registry.catalog())?);
    } else if args.first().map(String::as_str) == Some("--check") {
        if args.len() != 1 {
            return Err("Usage: inspect-content --check".into());
        }
        println!(
            "{} languages; content fingerprint {}",
            registry.languages.len(),
            registry.hash()
        );
    } else {
        let [language, variety, explanation, explanation_variety] = args.as_slice() else {
            return Err("Usage: inspect-content <language> <variety> <explanation-language> <explanation-variety>, or --check".into());
        };
        println!(
            "{}",
            serde_json::to_string_pretty(&registry.inspect_language(
                language,
                Some(variety),
                explanation,
                Some(explanation_variety)
            )?)?
        );
    }
    Ok(())
}
