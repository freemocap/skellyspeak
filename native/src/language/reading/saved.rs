//! Read-only annotation contracts. Product owners project their accepted records.
use super::ReadingScope;
use crate::model::{AppError, ErrorCode, GlossSegment, Result};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Deserialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SavedGlossQuery {
    pub scope: ReadingScope,
    /// Exact surfaces from the shared reading segmenter, including the passage.
    pub surfaces: Vec<String>,
}
impl SavedGlossQuery {
    pub fn validate(&self) -> Result<()> {
        if self.surfaces.is_empty()
            || self.surfaces.len() > 2049
            || self
                .surfaces
                .iter()
                .any(|s| s.is_empty() || s.contains('\0'))
            || self
                .surfaces
                .iter()
                .map(|s| s.encode_utf16().count())
                .sum::<usize>()
                > 4096
        {
            return Err(AppError::new(
                ErrorCode::Validation,
                "Saved word lookup requires bounded exact surfaces.",
            ));
        }
        Ok(())
    }
}

#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SavedGlossSource {
    pub source_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub dictionary: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub provenance: Option<SavedGlossProvenance>,
    pub operation_id: Option<String>,
    pub attempt_id: Option<String>,
    pub scope: ReadingScope,
    pub text: String,
    pub segments: Vec<GlossSegment>,
}

/// Authored imports never impersonate provider executions or learner evidence.
#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SavedGlossProvenance {
    pub package_id: String,
    pub version: String,
    pub sense: String,
    pub sources: Vec<String>,
    pub review: String,
}
