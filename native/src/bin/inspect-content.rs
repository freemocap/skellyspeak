//! Repository inspection uses the same parser, validator and resolver as the app.
use skellyspeak_core::configuration::Registry;
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let registry =
        Registry::load(&std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../content"))?;
    if args.as_slice() == ["--catalog"] {
        println!("{}", serde_json::to_string_pretty(&registry.catalog())?);
    } else if args.as_slice() == ["--communication"] {
        println!(
            "{}",
            serde_yaml_ng::to_string(registry.communication_catalog())?
        );
    } else if args.first().map(String::as_str) == Some("--communication-guide") {
        let [_, language, variety, explanation, group] = args.as_slice() else {
            return Err("Usage: inspect-content --communication-guide <language> <variety> <explanation-language> <group>".into());
        };
        print!(
            "{}",
            registry.communication_markdown(language, variety, explanation, group)?
        );
    } else if args.as_slice() == ["--communication-coverage"] {
        println!(
            "{}",
            serde_yaml_ng::to_string(&registry.communication_coverage())?
        );
    } else if args.as_slice() == ["--communication-ready"] {
        registry.require_complete_communication_content()?;
        println!(
            "Complete communication content: {}",
            registry.communication_content_hash()
        );
    } else if args.first().map(String::as_str) == Some("--communication-request") {
        let [_, language, variety, explanation] = args.as_slice() else {
            return Err("Usage: inspect-content --communication-request <language> <variety> <explanation-language>; provide state JSON on stdin".into());
        };
        use std::io::Read;
        let mut state = String::new();
        std::io::stdin().take(16001).read_to_string(&mut state)?;
        if state.len() > 16000 {
            return Err("Assessment state exceeds 16000 bytes.".into());
        }
        let state: serde_json::Value = serde_json::from_str(&state)?;
        if !state["currentLearnerMessage"].is_string() || !state["precedingExchange"].is_array() {
            return Err(
                "State requires currentLearnerMessage text and a precedingExchange array.".into(),
            );
        }
        println!(
            "{}",
            serde_json::to_string_pretty(&registry.communication_request(
                language,
                variety,
                explanation,
                state
            )?)?
        );
    } else if args.as_slice() == ["--skills"] {
        println!("{}", serde_yaml_ng::to_string(registry.shared_skills())?);
    } else if args.first().map(String::as_str) == Some("--skill-prompt") {
        let [_, language, variety, skill] = args.as_slice() else {
            return Err(
                "Usage: inspect-content --skill-prompt <language> <variety> <skill>".into(),
            );
        };
        println!(
            "{}",
            serde_yaml_ng::to_string(&registry.skill_prompt(language, variety, skill)?)?
        );
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
