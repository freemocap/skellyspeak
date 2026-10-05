//! Offline authoring validation. Never invokes a model or opens a workspace database.
use skellyspeak_core::configuration::authoring::{self, Content};
use std::{fs, path::Path};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../content");
    let args: Vec<_> = std::env::args().skip(1).collect();
    if args.as_slice() == ["--write-schemas"] || args.as_slice() == ["--check-schemas"] {
        for (name, schema) in authoring::schemas() {
            let path = root.join("rust-schemas").join(name);
            let expected = serde_yaml_ng::to_string(&schema)?;
            if args[0] == "--write-schemas" {
                fs::write(path, expected)?;
            } else if fs::read_to_string(&path)? != expected {
                return Err(format!("Stale schema: {}", path.display()).into());
            }
        }
        return Ok(());
    }
    let content = Content::load(&root)?;
    if args.first().map(String::as_str) == Some("--request") {
        let [_, language, variety] = args.as_slice() else {
            return Err(
                "Usage: audit-content --request <language> <variety>; state JSON on stdin".into(),
            );
        };
        use std::io::Read;
        let mut state = String::new();
        std::io::stdin().take(16001).read_to_string(&mut state)?;
        if state.len() > 16000 {
            return Err("State exceeds 16000 bytes.".into());
        }
        let specimen =
            content.assessment_specimen(language, variety, serde_json::from_str(&state)?)?;
        println!("{}", serde_json::to_string_pretty(&specimen)?);
        return Ok(());
    }
    match args.first().map(String::as_str) {
        Some("--coverage") if args.len() == 1 => {
            println!("{}", serde_yaml_ng::to_string(&content.coverage())?)
        }
        Some("--ready") if args.len() == 1 => {
            content.require_complete()?;
            println!("Required authored coverage is complete.");
        }
        Some("--check") if args.len() == 1 => {
            let c = content.coverage();
            println!(
                "Valid authored files: {} skills, {} subskills, {} languages, {} shared explanations, {} assessments, {} learner guides. {} required source files and {} bundled-target files remain unauthored.",
                c.definitions,
                c.subskills,
                c.languages,
                c.shared_explanations,
                c.assessments,
                c.learner_guides,
                c.required_missing.len(),
                c.missing.len()
            );
        }
        _ => {
            return Err(
                "Usage: audit-content --check|--coverage|--ready|--write-schemas|--check-schemas"
                    .into(),
            );
        }
    }
    Ok(())
}
