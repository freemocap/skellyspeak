//! Authored candidates are read-only until the learner explicitly keeps selected IDs.
use super::{
    DrillItemView,
    previews::{
        DrillCandidate, DrillGenerationPreview, DrillReportedLabels, DrillSource,
        DrillVerifiedProperties,
    },
};
use crate::{
    configuration::practice::{PracticeSet, PracticeSetSummary},
    language::reading::ReadingScope,
    model::Result,
    storage::store::Store,
};
use rusqlite::params;
use sha2::{Digest, Sha256};

impl Store {
    pub fn practice_sets(
        &self,
        language: &str,
        variety: Option<&str>,
    ) -> Result<Vec<PracticeSetSummary>> {
        self.config.practice_summaries(language, variety)
    }

    pub fn preview_practice_set(
        &self,
        scope: ReadingScope,
        set: PracticeSet,
    ) -> Result<DrillGenerationPreview> {
        let context = self.config.resolve_pair(
            &scope.language,
            scope.variety.as_deref(),
            &scope.explanation,
            scope.explanation_variety.as_deref(),
        )?;
        let phrases = self
            .config
            .practice_phrases(&context.language_id, Some(&context.variety_id))?
            .phrases(set);
        let scope_hash = format!("{:x}", Sha256::digest(serde_json::to_vec(&scope)?));
        let request_id = format!("bundled:{}:{scope_hash}:{}", self.config.hash(), set.key());
        let candidates = phrases
            .iter()
            .enumerate()
            .map(|(index, text)| {
                Ok(DrillCandidate {
                    candidate_id: format!("{request_id}:{index}"),
                    text: text.clone(),
                    translation: None,
                    reported: DrillReportedLabels {
                        difficulty: None,
                        tags: vec![],
                    },
                    verified: DrillVerifiedProperties {
                        scope_matches_request: true,
                        length_ok: true,
                        non_empty: true,
                        duplicate: super::previews::duplicate(&self.connection, &context, text)?,
                    },
                    source: DrillSource::Bundled {
                        set,
                        content_hash: self.config.hash().into(),
                    },
                })
            })
            .collect::<Result<Vec<_>>>()?;
        Ok(DrillGenerationPreview {
            requested: None,
            request_id,
            candidates,
            shortfall: None,
            receipt_id: None,
        })
    }

    pub fn accept_practice_phrases(
        &mut self,
        scope: ReadingScope,
        set: PracticeSet,
        request_id: &str,
        candidate_ids: Vec<String>,
    ) -> Result<Vec<DrillItemView>> {
        if candidate_ids.is_empty()
            || candidate_ids.len() > 50
            || candidate_ids
                .iter()
                .collect::<std::collections::BTreeSet<_>>()
                .len()
                != candidate_ids.len()
        {
            return Err(super::invalid("Select 1–50 distinct candidate IDs."));
        }
        let preview = self.preview_practice_set(scope.clone(), set)?;
        if preview.request_id != request_id {
            return Err(super::invalid(
                "The phrase bank or reading scope changed. Reload the phrases.",
            ));
        }
        let chosen = candidate_ids
            .iter()
            .map(|id| {
                preview
                    .candidates
                    .iter()
                    .find(|candidate| &candidate.candidate_id == id)
                    .ok_or_else(|| super::invalid("A selected phrase does not belong to this set."))
            })
            .collect::<Result<Vec<_>>>()?;
        let context = self.config.resolve_pair(
            &scope.language,
            scope.variety.as_deref(),
            &scope.explanation,
            scope.explanation_variety.as_deref(),
        )?;
        let tx = self.connection.transaction()?;
        let mut items = Vec::new();
        let mut created = false;
        for candidate in chosen {
            let id = if let Some(id) =
                super::previews::existing_item(&tx, &context, &candidate.text)?
            {
                id
            } else {
                let id = uuid::Uuid::new_v4().to_string();
                tx.execute("INSERT INTO drill_items(id,language_id,variety_id,explanation_language,explanation_variety_id,text,source) VALUES(?1,?2,?3,?4,?5,?6,?7)",
                    params![id, context.language_id, context.variety_id, context.explanation_language_id, context.explanation_variety_id, candidate.text, serde_json::to_string(&candidate.source)?])?;
                created = true;
                id
            };
            items.push(super::item(&tx, &id)?);
        }
        if created {
            tx.execute("UPDATE metadata SET revision=revision+1", [])?;
        }
        tx.commit()?;
        Ok(items)
    }
}

#[cfg(test)]
#[path = "bundled_tests.rs"]
mod tests;
