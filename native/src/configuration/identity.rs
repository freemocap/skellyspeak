//! Content identifiers are readable app identities, never external language tags.
use schemars::JsonSchema;
use serde::{Deserialize, Deserializer, Serialize};
use std::fmt;

macro_rules! identifier {
    ($name:ident) => {
        #[derive(Debug, Clone, Serialize, JsonSchema, PartialEq, Eq, PartialOrd, Ord)]
        #[serde(transparent)]
        pub struct $name(#[schemars(regex(pattern = "^[a-z][a-z0-9]*(-[a-z0-9]+)*$"))] pub String);
        impl fmt::Display for $name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                self.0.fmt(f)
            }
        }
        impl PartialEq<String> for $name {
            fn eq(&self, other: &String) -> bool {
                self.0 == *other
            }
        }
        impl PartialEq<&str> for $name {
            fn eq(&self, other: &&str) -> bool {
                self.0 == *other
            }
        }
        impl<'de> Deserialize<'de> for $name {
            fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
                let value = String::deserialize(deserializer)?;
                if !value.as_bytes().first().is_some_and(u8::is_ascii_lowercase)
                    || value.split('-').any(|part| {
                        part.is_empty()
                            || !part
                                .bytes()
                                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
                    })
                {
                    return Err(serde::de::Error::custom(
                        "Use a readable lowercase identifier with hyphens.",
                    ));
                }
                Ok(Self(value))
            }
        }
    };
}
identifier!(LanguageId);
identifier!(VarietyId);
identifier!(DefinitionId);

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ReviewStatus {
    NeedsReview,
    Reviewed,
}
impl fmt::Display for ReviewStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::NeedsReview => "needs_review",
            Self::Reviewed => "reviewed",
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum GuidanceScope {
    TargetWriting,
    ExplanationWriting,
    Segmentation,
    Reading,
    Romanization,
    Assessment,
    Pragmatics,
}
impl GuidanceScope {
    pub fn as_str(&self) -> &str {
        match self {
            Self::TargetWriting => "target_writing",
            Self::ExplanationWriting => "explanation_writing",
            Self::Segmentation => "segmentation",
            Self::Reading => "reading",
            Self::Romanization => "romanization",
            Self::Assessment => "assessment",
            Self::Pragmatics => "pragmatics",
        }
    }
}
impl PartialEq<&str> for GuidanceScope {
    fn eq(&self, other: &&str) -> bool {
        self.as_str() == *other
    }
}
impl PartialEq<String> for GuidanceScope {
    fn eq(&self, other: &String) -> bool {
        self.as_str() == other
    }
}
impl From<&str> for GuidanceScope {
    fn from(value: &str) -> Self {
        serde_json::from_value(serde_json::Value::String(value.into()))
            .expect("known guidance scope")
    }
}

impl fmt::Display for GuidanceScope {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}
