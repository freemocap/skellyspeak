//! Repository inspection uses the same parser, validator and resolver as the app.
use skellyspeak_core::configuration::Registry;
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let registry =
        Registry::load(&std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../content"))?;
    if args.as_slice() == ["--catalog"] {
        println!("{}", serde_json::to_string_pretty(&registry.catalog())?);
    } else if args.as_slice() == ["--skills"] {
        println!("{}", serde_yaml_ng::to_string(registry.shared_skills())?);
    } else if args.first().map(String::as_str) == Some("--skill-coverage") {
        let [_, language, variety] = args.as_slice() else {
            return Err("Usage: inspect-content --skill-coverage <language> <variety>".into());
        };
        println!(
            "{}",
            serde_yaml_ng::to_string(&registry.skill_coverage(language, variety)?)?
        );
    } else if matches!(
        args.first().map(String::as_str),
        Some("--skill-markdown" | "--skill-prompt")
    ) {
        let [mode, language, variety, skill] = args.as_slice() else {
            return Err("Usage: inspect-content --skill-markdown|--skill-prompt <language> <variety> <skill>".into());
        };
        if mode == "--skill-markdown" {
            print!("{}", registry.skill_markdown(language, variety, skill)?);
        } else {
            println!(
                "{}",
                serde_yaml_ng::to_string(&registry.skill_prompt(language, variety, skill)?)?
            );
        }
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
