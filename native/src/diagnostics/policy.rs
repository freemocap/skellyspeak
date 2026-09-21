//! Compiled adapter for the shared, authored diagnostic privacy policy.
use serde::Deserialize;
use std::sync::OnceLock;
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Policy {
    pub secret_tag: String,
    pub content_tag: String,
    pub public_fields: Vec<String>,
    pub secret_fields: Vec<String>,
    pub content_fields: Vec<String>,
    pub secret_field_fragments: Vec<String>,
    rules: Vec<Rule>,
}
#[derive(Deserialize)]
struct Rule {
    pattern: String,
    flags: String,
    kind: String,
    #[serde(default)]
    prefix: bool,
}
pub fn get() -> &'static Policy {
    static POLICY: OnceLock<Policy> = OnceLock::new();
    POLICY.get_or_init(|| {
        serde_json::from_str(include_str!("../../../content/diagnostics/policy.json"))
            .expect("compiled diagnostic policy")
    })
}
pub fn secret(key: &str) -> bool {
    let key = key.to_ascii_lowercase();
    get().secret_fields.contains(&key)
        || get()
            .secret_field_fragments
            .iter()
            .any(|part| key.contains(part))
}
pub fn sensitive(key: &str) -> bool {
    secret(key) || get().content_fields.contains(&key.to_ascii_lowercase())
}
pub fn tag(key: &str) -> &str {
    if secret(key) {
        &get().secret_tag
    } else {
        &get().content_tag
    }
}
pub fn scrub(text: &str, private: &[&str]) -> String {
    static RULES: OnceLock<Vec<(regex::Regex, bool, bool)>> = OnceLock::new();
    let rules = RULES.get_or_init(|| {
        get()
            .rules
            .iter()
            .map(|r| {
                (
                    regex::RegexBuilder::new(&r.pattern)
                        .case_insensitive(r.flags.contains('i'))
                        .build()
                        .expect("compiled redaction rule"),
                    r.kind == "secret",
                    r.prefix,
                )
            })
            .collect()
    });
    let mut text = text.to_owned();
    // Recognizable secrets are classified before exact content redaction.
    for (rule, _, prefix) in rules.iter().filter(|(_, secret, _)| *secret) {
        let replacement = format!("{}{}", if *prefix { "${1}" } else { "" }, get().secret_tag);
        text = rule.replace_all(&text, replacement.as_str()).into_owned();
    }
    let mut private = private.to_vec();
    private.sort_by_key(|v| std::cmp::Reverse(v.len()));
    for value in private {
        if !value.is_empty() {
            text = text.replace(value, &get().content_tag);
        }
    }
    for (rule, _, prefix) in rules.iter().filter(|(_, secret, _)| !*secret) {
        let replacement = format!("{}{}", if *prefix { "${1}" } else { "" }, get().content_tag);
        text = rule.replace_all(&text, replacement.as_str()).into_owned();
    }
    let clean: String = text
        .chars()
        .filter(|c| !c.is_control() || *c == '\n' || *c == '\t')
        .collect();
    if clean.chars().count() > 4096 {
        format!(
            "{}[truncated: string limit]",
            clean.chars().take(4096).collect::<String>()
        )
    } else {
        clean
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn shared_redaction_conformance() {
        let cases: serde_json::Value = serde_json::from_str(include_str!(
            "../../../content/diagnostics/retention-cases.json"
        ))
        .unwrap();
        for case in cases.as_array().unwrap() {
            let private: Vec<_> = case["private"]
                .as_array()
                .unwrap()
                .iter()
                .map(|v| v.as_str().unwrap())
                .collect();
            let result = scrub(case["text"].as_str().unwrap(), &private);
            for kept in case["kept"].as_array().unwrap() {
                assert!(
                    result.contains(kept.as_str().unwrap()),
                    "{}: {result}",
                    case["name"]
                );
            }
            for removed in case["removed"].as_array().unwrap() {
                assert!(
                    !result.contains(removed.as_str().unwrap()),
                    "{}",
                    case["name"]
                );
            }
            if let Some(tag) = case["tag"].as_str() {
                assert!(result.contains(tag), "{}: {result}", case["name"]);
            }
            assert_eq!(
                scrub(&result, &private),
                result,
                "redaction must be idempotent"
            );
        }
    }
}
