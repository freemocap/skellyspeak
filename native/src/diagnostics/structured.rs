//! Content-free inspection of structured model output. This is diagnostic only;
//! domain validators remain authoritative and no output is repaired here.
use crate::model::{AppError, ErrorCode, Result};
use serde::de::DeserializeOwned;
use serde_json::{Value, json};

pub(crate) fn decode<T: DeserializeOwned>(text: &str, schema: &Value, owner: &str) -> Result<T> {
    serde_json::from_str(text).map_err(|error| {
        let detail = inspect(text, schema);
        AppError::new(
            ErrorCode::Validation,
            format!(
                "{owner}: {} at {} (JSON {:?}, line {}, column {}).",
                detail["reason"].as_str().unwrap_or("rust_type_mismatch"),
                detail["path"].as_str().unwrap_or("$"),
                error.classify(),
                error.line(),
                error.column()
            ),
        )
    })
}

pub(crate) fn inspect(text: &str, schema: &Value) -> Value {
    match serde_json::from_str::<Value>(text) {
        Err(error) => json!({"reason":"invalid_json", "line":error.line(), "column":error.column(),
            "category":format!("{:?}", error.classify())}),
        Ok(value) => mismatch(&value, schema, "$", 0)
            .unwrap_or_else(|| json!({"reason":"no_structural_mismatch_detected"})),
    }
}

fn mismatch(value: &Value, schema: &Value, path: &str, depth: usize) -> Option<Value> {
    let fail = |reason: &str| Some(json!({"reason":reason,"path":path}));
    if depth > 32 {
        return fail("inspection_depth_limit");
    }
    let matches_type = |kind: &str| match kind {
        "null" => value.is_null(),
        "object" => value.is_object(),
        "array" => value.is_array(),
        "string" => value.is_string(),
        "boolean" => value.is_boolean(),
        "integer" => value.is_i64() || value.is_u64(),
        "number" => value.is_number(),
        _ => true,
    };
    if let Some(kind) = schema["type"].as_str() {
        if !matches_type(kind) {
            return fail("wrong_type");
        }
    } else if let Some(kinds) = schema["type"].as_array()
        && !kinds.iter().any(|k| k.as_str().is_some_and(matches_type))
    {
        return fail("wrong_type");
    }
    if schema
        .get("const")
        .is_some_and(|expected| expected != value)
    {
        return fail("unexpected_constant");
    }
    if let Some(variants) = schema["enum"].as_array()
        && !variants.contains(value)
    {
        return fail("invalid_enum");
    }
    if let Some(object) = value.as_object() {
        if let Some(required) = schema["required"].as_array() {
            for key in required.iter().filter_map(Value::as_str) {
                if !object.contains_key(key) {
                    return Some(json!({"reason":"missing_field","path":format!("{path}.{key}")}));
                }
            }
        }
        if let Some(properties) = schema["properties"].as_object() {
            // Never copy unknown keys or values from model output into diagnostics.
            if schema["additionalProperties"] == false
                && object.keys().any(|k| !properties.contains_key(k))
            {
                return fail("unknown_field");
            }
            for (key, rule) in properties {
                if let Some(child) = object.get(key)
                    && let Some(problem) =
                        mismatch(child, rule, &format!("{path}.{key}"), depth + 1)
                {
                    return Some(problem);
                }
            }
        }
    }
    if let Some(items) = value.as_array() {
        if schema["maxItems"]
            .as_u64()
            .is_some_and(|max| items.len() as u64 > max)
        {
            return fail("too_many_items");
        }
        for (index, child) in items.iter().take(128).enumerate() {
            if let Some(problem) = mismatch(
                child,
                &schema["items"],
                &format!("{path}[{index}]"),
                depth + 1,
            ) {
                return Some(problem);
            }
        }
        if items.len() > 128 {
            return fail("inspection_item_limit");
        }
    }
    if let Some(text) = value.as_str() {
        let length = text.chars().count() as u64;
        if schema["minLength"].as_u64().is_some_and(|min| length < min) {
            return fail("string_too_short");
        }
        if schema["maxLength"].as_u64().is_some_and(|max| length > max) {
            return fail("string_too_long");
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn names_nested_schema_paths_without_echoing_output() {
        let schema = json!({"type":"object","additionalProperties":false,"properties":{"items":{"type":"array","items":{"type":"object","required":["outcome"],"properties":{"outcome":{"enum":["demonstrated"]}}}}}});
        for (text, reason, path) in [
            (
                r#"{"items":[{"outcome":"SECRET"}]}"#,
                "invalid_enum",
                "$.items[0].outcome",
            ),
            (r#"{"items":[{}]}"#, "missing_field", "$.items[0].outcome"),
            (r#"{"SECRET":"SECRET"}"#, "unknown_field", "$"),
        ] {
            let result = inspect(text, &schema);
            assert_eq!(result["reason"], reason);
            assert_eq!(result["path"], path);
            assert!(!result.to_string().contains("SECRET"));
        }
        assert_eq!(inspect("{", &schema)["category"], "Eof");
    }
}
