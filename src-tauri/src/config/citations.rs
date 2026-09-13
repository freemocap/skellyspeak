use std::collections::BTreeMap;
// Deliberately bounded to this repository's braced BibTeX entries/fields, with
// nested braces and escapes supported. Unsupported or malformed input fails.
pub(super) fn parse_bib(
    source: &str,
) -> std::result::Result<BTreeMap<String, BTreeMap<String, String>>, String> {
    let mut entries = BTreeMap::new();
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
        if key.trim().is_empty() || entries.contains_key(key.trim()) {
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
            if fields
                .insert(name, value[..end].trim().to_owned())
                .is_some()
            {
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
        if !["abstract", "full-text", "reviewed"].contains(&fields["review"].as_str()) {
            return Err(format!("Invalid review state in {key}"));
        }
        entries.insert(key.trim().to_owned(), fields);
    }
    Ok(entries)
}
