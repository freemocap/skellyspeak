//! Durable reviewed candidates. Only native IDs can become sourced Drill items.
use super::{DrillItemView, generation::DrillGenerationInput};
use crate::{configuration::LanguageContext, model::*, storage::store::Store};
use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum DrillSource {
    Own,
    Generated {
        #[ts(optional)]
        #[serde(skip_serializing_if = "Option::is_none")]
        skill_focus: Option<super::skill_focus::DrillSkillFocus>,
        request_id: String,
        candidate_id: String,
        topic: Option<String>,
        difficulty: Difficulty,
        length: super::generation::DrillLength,
    },
    Conversation {
        source_ref: DrillConversationRef,
        revision: String,
    },
}
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DrillConversationRef {
    pub conversation_id: String,
    pub message_id: String,
    pub turn_id: String,
    pub role: String,
    pub start_byte: u32,
    pub end_byte: u32,
}
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(deny_unknown_fields)]
pub struct DrillReportedLabels {
    pub difficulty: Option<String>,
    pub tags: Vec<String>,
}
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DrillVerifiedProperties {
    pub scope_matches_request: bool,
    pub length_ok: bool,
    pub non_empty: bool,
    pub duplicate: bool,
}
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DrillCandidate {
    pub candidate_id: String,
    pub text: String,
    pub translation: Option<String>,
    pub reported: DrillReportedLabels,
    pub verified: DrillVerifiedProperties,
    pub source: DrillSource,
}
#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct DrillShortfall {
    pub requested: u32,
    pub produced: u32,
    pub reason: String,
}
#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct DrillGenerationPreview {
    pub requested: Option<DrillGenerationInput>,
    pub request_id: String,
    pub candidates: Vec<DrillCandidate>,
    pub shortfall: Option<DrillShortfall>,
    pub receipt_id: Option<String>,
}

pub(crate) fn valid_text(text: &str) -> bool {
    !text.trim().is_empty() && text.encode_utf16().count() <= 512 && !text.contains('\0')
}
pub(crate) fn duplicate(db: &Connection, scope: &LanguageContext, text: &str) -> Result<bool> {
    Ok(db.query_row("SELECT EXISTS(SELECT 1 FROM drill_items WHERE language_id=?1 AND variety_id=?2 AND text=?3 AND archived=0)",params![scope.language_id,scope.variety_id,text],|r|r.get(0))?)
}
#[derive(Deserialize, Serialize)]
pub(crate) struct PreviewInput {
    pub skill_focus: Option<super::skill_focus::DrillSkillFocus>,
    pub scope: crate::language::reading::ReadingScope,
    pub count: u32,
    pub requested: Option<DrillGenerationInput>,
}
pub(crate) fn input(db: &Connection, id: &str) -> Result<PreviewInput> {
    let value: String = db
        .query_row("SELECT input FROM drill_previews WHERE id=?1", [id], |r| {
            r.get(0)
        })
        .optional()?
        .ok_or_else(|| super::invalid("This Drill preview does not exist."))?;
    Ok(serde_json::from_str(&value)?)
}
pub(crate) fn reserve(
    db: &Connection,
    id: &str,
    kind: &str,
    input: &PreviewInput,
    receipt: Option<&str>,
) -> Result<()> {
    db.execute("DELETE FROM drill_previews WHERE expires_at<=datetime('now') AND NOT EXISTS(SELECT 1 FROM drill_candidates c WHERE c.preview_id=drill_previews.id AND c.accepted_item_id IS NOT NULL)",[])?;
    let count:i64=db.query_row("SELECT COUNT(*) FROM drill_previews p WHERE NOT EXISTS(SELECT 1 FROM drill_candidates c WHERE c.preview_id=p.id AND c.accepted_item_id IS NOT NULL)",[],|r|r.get(0))?;
    if count >= 100 {
        return Err(AppError::new(
            ErrorCode::AdmissionHeld,
            "Too many unaccepted previews. Accept or discard a preview before requesting more.",
        ));
    }
    db.execute(
        "INSERT INTO drill_previews(id,kind,input,receipt_id) VALUES(?1,?2,?3,?4)",
        params![id, kind, serde_json::to_string(input)?, receipt],
    )?;
    Ok(())
}
pub(crate) fn persist(db: &Connection, id: &str, candidates: &[DrillCandidate]) -> Result<()> {
    for (index, candidate) in candidates.iter().enumerate() {
        db.execute(
            "INSERT INTO drill_candidates(id,preview_id,ordinal,data) VALUES(?1,?2,?3,?4)",
            params![
                candidate.candidate_id,
                id,
                index as i64,
                serde_json::to_string(candidate)?
            ],
        )?;
    }
    db.execute("UPDATE drill_previews SET ready=1 WHERE id=?1", [id])?;
    Ok(())
}
impl Store {
    pub fn discard_drill_preview(&mut self, id: &str) -> Result<()> {
        let tx = self.connection.transaction()?;
        tx.execute(
            "DELETE FROM drill_candidates WHERE preview_id=?1 AND accepted_item_id IS NULL",
            [id],
        )?;
        tx.execute(
            "UPDATE drill_previews SET expires_at=datetime('now'),ready=0 WHERE id=?1",
            [id],
        )?;
        // Retain accepted provenance and allow idempotent retrieval of accepted IDs.
        tx.execute("UPDATE drill_previews SET ready=1 WHERE id=?1 AND EXISTS(SELECT 1 FROM drill_candidates WHERE preview_id=?1 AND accepted_item_id IS NOT NULL)",[id])?;
        tx.commit()?;
        Ok(())
    }
    pub fn drill_preview(&self, id: &str) -> Result<DrillGenerationPreview> {
        let (ready, receipt_id): (bool, Option<String>) = self
            .connection
            .query_row(
                "SELECT ready,receipt_id FROM drill_previews WHERE id=?1",
                [id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()?
            .ok_or_else(|| super::invalid("This Drill preview does not exist."))?;
        if !ready {
            return Err(super::invalid("This Drill preview is not ready."));
        }
        let input = input(&self.connection, id)?;
        let candidates = self
            .connection
            .prepare("SELECT data FROM drill_candidates WHERE preview_id=?1 ORDER BY ordinal")?
            .query_map([id], |r| r.get::<_, String>(0))?
            .map(|row| Ok(serde_json::from_str(&row?)?))
            .collect::<Result<Vec<DrillCandidate>>>()?;
        let count = candidates.len() as u32;
        Ok(DrillGenerationPreview{requested:input.requested,request_id:id.into(),receipt_id,candidates,shortfall:(count<input.count).then(||DrillShortfall{requested:input.count,produced:count,reason:"Fewer usable, non-duplicate phrases were available. No automatic regeneration was attempted.".into()})})
    }
    pub fn accept_drill_items(&mut self, id: &str, ids: &[String]) -> Result<Vec<DrillItemView>> {
        if ids.is_empty()
            || ids.len() > 50
            || ids.iter().collect::<std::collections::HashSet<_>>().len() != ids.len()
        {
            return Err(super::invalid("Select 1–50 distinct candidate IDs."));
        }
        let input = input(&self.connection, id)?;
        let scope = self.config.resolve_pair(
            &input.scope.language,
            input.scope.variety.as_deref(),
            &input.scope.explanation,
            input.scope.explanation_variety.as_deref(),
        )?;
        let tx = self.connection.transaction()?;
        let (ready, expired, receipt): (bool, bool, Option<String>) = tx.query_row(
            "SELECT ready,expires_at<=datetime('now'),receipt_id FROM drill_previews WHERE id=?1",
            [id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )?;
        if !ready {
            return Err(super::invalid("This Drill preview is not ready."));
        }
        if let Some(receipt) = receipt {
            let succeeded: bool = tx.query_row(
                "SELECT state='succeeded' FROM generation_attempts WHERE id=?1",
                [receipt],
                |r| r.get(0),
            )?;
            if !succeeded {
                return Err(super::invalid(
                    "This generation did not complete successfully.",
                ));
            }
        }
        let mut items = Vec::new();
        let mut created = false;
        for candidate_id in ids {
            let (data,accepted):(String,Option<String>)=tx.query_row("SELECT data,accepted_item_id FROM drill_candidates WHERE id=?1 AND preview_id=?2",params![candidate_id,id],|r|Ok((r.get(0)?,r.get(1)?))).optional()?.ok_or_else(||super::invalid("A selected candidate does not belong to this preview."))?;
            if let Some(item) = accepted {
                // Missing item is an explicit tombstone: never resurrect a deletion.
                items.push(super::item(&tx, &item)?);
                continue;
            }
            if expired {
                return Err(super::invalid(
                    "This preview expired. Request a new preview.",
                ));
            }
            let candidate: DrillCandidate = serde_json::from_str(&data)?;
            if !valid_text(&candidate.text) || duplicate(&tx, &scope, &candidate.text)? {
                return Err(super::invalid(
                    "A selected phrase is invalid or already exists. Refresh the selection.",
                ));
            }
            super::conversation_source::validate(&tx, &candidate, &scope)?;
            created = true;
            let item = uuid::Uuid::new_v4().to_string();
            tx.execute("INSERT INTO drill_items(id,language_id,variety_id,explanation_language,explanation_variety_id,text,source) VALUES(?1,?2,?3,?4,?5,?6,?7)",params![item,scope.language_id,scope.variety_id,scope.explanation_language_id,scope.explanation_variety_id,candidate.text,serde_json::to_string(&candidate.source)?])?;
            tx.execute(
                "UPDATE drill_candidates SET accepted_item_id=?2 WHERE id=?1",
                params![candidate_id, item],
            )?;
            items.push(super::item(&tx, &item)?);
        }
        if created {
            tx.execute("UPDATE metadata SET revision=revision+1", [])?;
        }
        tx.commit()?;
        Ok(items)
    }
}
