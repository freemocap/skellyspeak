use super::*;
use std::collections::{BTreeMap, BTreeSet};

// Deliberately bounded to this repository's braced BibTeX entries/fields, with
// nested braces and escapes supported. Unsupported or malformed input fails.
fn parse_bib(source: &str) -> std::result::Result<BTreeSet<String>, String> {
    let mut entries = BTreeSet::new();
    let mut text = source;
    while !text.trim().is_empty() {
        text = text.trim_start();
        if text.starts_with('%') {
            text = text.split_once('\n').map_or("", |(_, rest)| rest);
            continue;
        }
        let entry = text.strip_prefix('@').ok_or("Expected entry")?;
        let (kind, body) = entry.split_once('{').ok_or("Expected entry brace")?;
        if !kind.chars().all(|c| c.is_ascii_alphabetic()) {
            return Err("Invalid entry type".into());
        }
        let (key, mut body) = body.split_once(',').ok_or("Missing entry key")?;
        if key.trim().is_empty() || !entries.insert(key.trim().to_owned()) {
            return Err(format!("Empty or duplicate citation key: {key}"));
        }
        let mut fields = BTreeMap::new();
        loop {
            body = body.trim_start();
            if let Some(rest) = body.strip_prefix('}') {
                text = rest;
                break;
            }
            let (name, value) = body.split_once('=').ok_or("Missing field assignment")?;
            let name = name.trim().to_ascii_lowercase();
            if !name.chars().all(|c| c.is_ascii_alphabetic() || c == '-') {
                return Err(format!("Invalid field in {key}"));
            }
            let value = value
                .trim_start()
                .strip_prefix('{')
                .ok_or("Expected braced value")?;
            let mut depth = 1;
            let mut escaped = false;
            let mut end = None;
            for (i, c) in value.char_indices() {
                if escaped {
                    escaped = false;
                    continue;
                }
                if c == '\\' {
                    escaped = true;
                    continue;
                }
                match c {
                    '{' => depth += 1,
                    '}' => depth -= 1,
                    _ => (),
                }
                if depth == 0 {
                    end = Some(i);
                    break;
                }
            }
            let end = end.ok_or("Unclosed field")?;
            if fields.insert(name, value[..end].trim()).is_some() {
                return Err(format!("Duplicate field in {key}"));
            }
            body = value[end + 1..].trim_start();
            if let Some(rest) = body.strip_prefix(',') {
                body = rest;
            } else if !body.starts_with('}') {
                return Err("Missing field separator".into());
            }
        }
        let has = |field| fields.get(field).is_some_and(|v| !v.is_empty());
        if !(has("url") || has("doi")) || !has("review") || !has("claim") {
            return Err(format!("Missing url/doi, review or claim in {key}"));
        }
    }
    Ok(entries)
}

#[test]
fn bibliography_is_complete_and_every_scheme_source_exists() {
    let keys = parse_bib(include_str!("../../references.bib")).unwrap();
    assert!(!keys.is_empty());
    for scheme in SCHEMES {
        assert!(!scheme.sources.is_empty());
        for key in scheme.sources {
            assert!(keys.contains(*key), "Missing citation {key}");
        }
    }
}

#[test]
fn citation_parser_rejects_missing_fields_duplicates_and_malformed_entries() {
    let valid =
        "@misc{a, url={https://example.com}, review={abstract}, claim={Nested {claim} text}}";
    assert!(parse_bib(valid).is_ok());
    assert!(parse_bib(&valid.replace("url=", "doi=")).is_ok());
    for bad in [
        valid.replace("review={abstract},", ""),
        valid.replace("claim={Nested {claim} text}", "claim={}"),
        valid.replace("url={https://example.com},", ""),
        format!("{valid}\n{valid}"),
        valid[..valid.len() - 1].to_owned(),
    ] {
        assert!(parse_bib(&bad).is_err(), "accepted {bad}");
    }
}

#[test]
fn arabic_gloss_prompt_snapshot_has_explicit_scheme_and_preserves_source() {
    use crate::linguistics::{ANALYSIS_VERSION, SourceIdentity, adapter};
    let source = "كيف حالك؟";
    let identity = SourceIdentity {
        message_id: "arabic-fixture".into(),
        target_language_id: "ar".into(),
        explanation_language_id: "en".into(),
        analysis_version: ANALYSIS_VERSION.into(),
    };
    let prompt = adapter::build_word_gloss_prompt(&identity, source).unwrap();
    let system = &prompt.messages[0].content;
    let guidance = romanization_guidance("ar").unwrap().unwrap();
    assert!(system.contains(&guidance));
    assert_eq!(
        guidance,
        include_str!("language_fixtures/arabic-romanization-prompt.txt").trim_end()
    );
    assert!(system.contains("al- before sun letters without assimilation"));
    assert!(!system.contains("standard romanization"));
    let data: serde_json::Value = serde_json::from_str(&prompt.messages[1].content).unwrap();
    assert_eq!(data["passage"], source);
    assert_eq!(prompt.template_id, "persona-word-gloss-prompt-v5");
}
