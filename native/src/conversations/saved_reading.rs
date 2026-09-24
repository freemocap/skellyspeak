//! Projection of accepted annotations, independent of snapshot pagination or mounted views.
use crate::{
    language::reading::{
        ReadingScope,
        saved::{SavedGlossQuery, SavedGlossSource},
    },
    model::*,
    storage::store::Store,
};
use rusqlite::params;

pub(crate) fn sources(store: &Store, query: &SavedGlossQuery) -> Result<Vec<SavedGlossSource>> {
    query.validate()?;
    let language = store.config.resolve_pair(
        &query.scope.language,
        query.scope.variety.as_deref(),
        &query.scope.explanation,
        query.scope.explanation_variety.as_deref(),
    )?;
    let scope = ReadingScope {
        language: language.language_id,
        variety: Some(language.variety_id),
        explanation: language.explanation_language_id,
        explanation_variety: Some(language.explanation_variety_id),
    };
    // Accepted records remain authoritative. No AI access check, attempt creation or cache write.
    let mut statement = store.connection.prepare(
        "SELECT m.id,m.text,m.role,t.context FROM messages m JOIN turns t ON t.id=m.turn_id JOIN conversations c ON c.id=t.conversation_id JOIN contacts r ON r.id=c.contact_id
         WHERE c.archived=0 AND r.archived=0 AND t.state NOT IN ('cancelled','invalidated')
         AND NOT EXISTS(SELECT 1 FROM turns replacement WHERE replacement.replaces_turn_id=t.id)
         AND json_extract(t.context,'$.languageContext.language_id')=?1
         AND json_extract(t.context,'$.languageContext.variety_id')=?2
         AND json_extract(t.context,'$.languageContext.explanation_language_id')=?3
         AND json_extract(t.context,'$.languageContext.explanation_variety_id')=?4
         AND (json_type(t.context,'$.userWordGloss')='object' OR json_type(t.context,'$.wordGloss')='object' OR json_type(t.context,'$.coachReplies')='array')
         AND EXISTS(SELECT 1 FROM json_each(?5) surface WHERE instr(m.text,surface.value)>0 OR (m.role='assistant' AND EXISTS(SELECT 1 FROM json_each(json_extract(t.context,'$.coachReplies')) suggestion WHERE instr(json_extract(suggestion.value,'$.text'),surface.value)>0)))
         ORDER BY m.rowid"
    )?;
    let rows = statement.query_map(
        params![
            scope.language,
            scope.variety,
            scope.explanation,
            scope.explanation_variety,
            serde_json::to_string(&query.surfaces)?
        ],
        |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
            ))
        },
    )?;
    let mut output = Vec::new();
    let mut bytes = 0;
    for row in rows {
        let (id, text, role, context) = row?;
        let context: serde_json::Value = serde_json::from_str(&context)?;
        let field = if role == "user" {
            "userWordGloss"
        } else {
            "wordGloss"
        };
        if let Some(value) = context.get(field).filter(|v| !v.is_null()) {
            let view: WordGlossView = serde_json::from_value(value.clone())?;
            if view.source_message_id != id
                || view.target_language_id != scope.language
                || view.explanation_language_id != scope.explanation
            {
                return Err(AppError::new(
                    ErrorCode::Storage,
                    "Saved word meanings do not match their source identity.",
                ));
            }
            append(
                &mut output,
                &mut bytes,
                query,
                SavedGlossSource {
                    source_id: id.clone(),
                    operation_id: Some(view.operation_id),
                    attempt_id: Some(view.attempt_id),
                    scope: scope.clone(),
                    text,
                    segments: view.segments,
                },
            )?;
        }
        if role == "assistant"
            && let Some(value) = context.get("coachReplies").filter(|v| !v.is_null())
        {
            let replies: Vec<crate::learning::coaching::SuggestedReply> =
                serde_json::from_value(value.clone())?;
            for (index, reply) in replies.into_iter().enumerate() {
                append(
                    &mut output,
                    &mut bytes,
                    query,
                    SavedGlossSource {
                        source_id: format!("{id}/suggestion/{index}"),
                        operation_id: None,
                        attempt_id: context["coachRepliesAttempt"].as_str().map(str::to_owned),
                        scope: scope.clone(),
                        text: reply.text,
                        segments: reply.segments,
                    },
                )?;
            }
        }
    }
    Ok(output)
}

fn append(
    output: &mut Vec<SavedGlossSource>,
    bytes: &mut usize,
    query: &SavedGlossQuery,
    source: SavedGlossSource,
) -> Result<()> {
    if !query
        .surfaces
        .iter()
        .any(|surface| source.text.contains(surface))
    {
        return Ok(());
    }
    let length = source.text.encode_utf16().count();
    if source
        .segments
        .iter()
        .any(|s| s.start >= s.end || s.end as usize > length)
    {
        return Err(AppError::new(
            ErrorCode::Storage,
            "Saved word meanings have invalid source anchors.",
        ));
    }
    *bytes += serde_json::to_vec(&source)?.len();
    if *bytes > 8 * 1024 * 1024 {
        return Err(AppError::new(
            ErrorCode::Validation,
            "Saved word lookup exceeds its response limit. Select a shorter passage.",
        ));
    }
    output.push(source);
    Ok(())
}
