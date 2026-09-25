//! Read projection of evictable generated glosses, scoped to current local access.
use super::{
    saved::{SavedGlossQuery, SavedGlossSource},
    text::Stored,
    *,
};
use crate::ai::results;
use rusqlite::params;

pub(crate) fn sources(store: &Store, query: &SavedGlossQuery) -> Result<Vec<SavedGlossSource>> {
    query.validate()?;
    // Signing out removes eligibility for generated results, without hiding accepted records.
    let configured: bool = store.connection.query_row(
        "SELECT CASE route WHEN 'hosted' THEN hosted_credential_id IS NOT NULL ELSE custom_credential_id IS NOT NULL OR json_extract(custom_config,'$.bearerAuth')=0 END FROM ai_config", [], |r| r.get(0))?;
    if !configured {
        return Ok(Vec::new());
    }
    let context = store.config.resolve_pair(
        &query.scope.language,
        query.scope.variety.as_deref(),
        &query.scope.explanation,
        query.scope.explanation_variety.as_deref(),
    )?;
    let scope = text::current_scope(store)?;
    let mut statement = store.connection.prepare(
        "SELECT r.id FROM inference_results r JOIN inference_blobs b ON b.digest=r.blob_digest JOIN inference_executions e ON e.id=r.id
         WHERE e.task='reading_gloss' AND e.state='succeeded'
         AND json_extract(CAST(b.payload AS TEXT),'$.access_scope')=?1
         AND json_extract(CAST(b.payload AS TEXT),'$.scope.language')=?2
         AND json_extract(CAST(b.payload AS TEXT),'$.scope.variety')=?3
         AND json_extract(CAST(b.payload AS TEXT),'$.scope.explanation')=?4
         AND json_extract(CAST(b.payload AS TEXT),'$.scope.explanationVariety')=?5
         AND EXISTS(SELECT 1 FROM json_each(?6) surface WHERE instr(json_extract(CAST(b.payload AS TEXT),'$.text'),surface.value)>0)
         ORDER BY e.rowid"
    )?;
    let ids = statement
        .query_map(
            params![
                scope,
                context.language_id,
                context.variety_id,
                context.explanation_language_id,
                context.explanation_variety_id,
                serde_json::to_string(&query.surfaces)?
            ],
            |r| r.get::<_, String>(0),
        )?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    let mut output = Vec::new();
    let mut bytes = 0;
    for id in ids {
        if let Some(saved) = results::read(&store.connection, &id)? {
            let stored = Stored::decode(&saved.payload)?;
            let view = stored.gloss.ok_or_else(|| {
                AppError::new(
                    ErrorCode::Storage,
                    "Saved gloss result is missing its annotations.",
                )
            })?;
            let source = SavedGlossSource {
                source_id: format!("inference/{id}"),
                operation_id: Some(view.operation_id),
                attempt_id: Some(view.attempt_id),
                scope: stored.scope,
                text: stored.text,
                segments: view.segments,
            };
            bytes += serde_json::to_vec(&source)?.len();
            if bytes > 8 * 1024 * 1024 {
                return Err(AppError::new(
                    ErrorCode::Validation,
                    "Saved word lookup exceeds its response limit. Select a shorter passage.",
                ));
            }
            output.push(source);
        }
    }
    Ok(output)
}
