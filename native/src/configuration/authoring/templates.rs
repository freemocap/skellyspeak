//! Templates are checked separately and never admitted to runtime content.
use super::*;
use crate::configuration::{Result, error};
use serde::de::DeserializeOwned;
use serde_yaml_ng::Value;
use std::{fs, path::Path};

fn materialize(value: &mut Value) {
    match value {
        Value::String(s) if s.contains("__") => *s = "template".into(),
        Value::Sequence(items) => items.iter_mut().for_each(materialize),
        Value::Mapping(mapping) => {
            let values = std::mem::take(mapping);
            for (mut key, mut value) in values {
                materialize(&mut key);
                materialize(&mut value);
                mapping.insert(key, value);
            }
        }
        _ => {}
    }
}

fn check<T: DeserializeOwned>(root: &Path, path: &str) -> Result<()> {
    let source = fs::read_to_string(root.join(path)).map_err(|e| error(path, "template", e))?;
    if !source.contains("__") {
        return Err(error(
            path,
            "template",
            "Expected explicit authoring placeholders.",
        ));
    }
    let mut value: Value =
        serde_yaml_ng::from_str(&source).map_err(|e| error(path, "template", e))?;
    materialize(&mut value);
    serde_yaml_ng::from_value::<T>(value).map_err(|e| error(path, "template", e))?;
    Ok(())
}

pub fn validate(root: &Path) -> Result<()> {
    check::<Language>(
        root,
        "languages/__TARGET_LANGUAGE_TEMPLATE/__TARGET_LANGUAGE__-language.yaml",
    )?;
    check::<Assessment>(
        root,
        "languages/__TARGET_LANGUAGE_TEMPLATE/skills/__SKILL__/__TARGET_LANGUAGE__-__SKILL__-assessment.yaml",
    )?;
    check::<Guide>(
        root,
        "languages/__TARGET_LANGUAGE_TEMPLATE/skills/__SKILL__/__TARGET_LANGUAGE__-__SKILL__-explained-in-__EXPLANATION_LANGUAGE__.yaml",
    )?;
    check::<Definition>(root, "skills/__SKILL_TEMPLATE/__SKILL__-definition.yaml")?;
    check::<Subskills>(root, "skills/__SKILL_TEMPLATE/__SKILL__-subskills.yaml")?;
    check::<Explanation>(
        root,
        "skills/__SKILL_TEMPLATE/__SKILL__-explained-in-__EXPLANATION_LANGUAGE__.yaml",
    )?;
    for folder in [
        "languages",
        "skills",
        "prompts",
        "policies",
        "language-foundations",
        "conversation-topics",
        "speech",
        "rust-schemas",
    ] {
        let path = format!(
            "{folder}/{}_README.md",
            folder.replace('-', "_").to_uppercase()
        );
        let text = fs::read_to_string(root.join(&path)).map_err(|e| error(&path, "readme", e))?;
        if text.trim().is_empty() {
            return Err(error(path, "readme", "Folder README cannot be empty."));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn templates_match_their_rust_contracts() {
        validate(&Path::new(env!("CARGO_MANIFEST_DIR")).join("../content")).unwrap();
    }
}
