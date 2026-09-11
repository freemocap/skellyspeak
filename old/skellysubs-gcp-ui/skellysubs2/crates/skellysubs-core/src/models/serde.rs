//! Small shared serde helpers.

use serde::{Deserialize, Deserializer};

/// Deserializes an optional string, mapping `null`, `""`, and `"NONE"`
/// (any case) to `None`. The language configs use the literal string `"NONE"`
/// to mean "no romanization", and LLM outputs sometimes return `""` or `null`.
pub(crate) fn opt_none_string<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: Deserializer<'de>,
{
    let value: Option<String> = Option::deserialize(deserializer)?;
    Ok(value.filter(|s| !s.is_empty() && !s.eq_ignore_ascii_case("none")))
}
