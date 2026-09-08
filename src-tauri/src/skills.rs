//! Language-independent rubrics and an assessment ledger per chat.
pub mod progress;
use serde::{Deserialize, Serialize};
use std::{collections::HashSet, path::Path};

pub const CATALOG_VERSION: u32 = 3;
pub const PROMPT_VERSION: &str = "skill-evidence-5";
pub const FILE: &str = "skill-evidence.json";
pub const LEARNER: &str = "local";

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SkillDefinition {
    pub id: String,
    pub parent: Option<String>,
    pub label: String,
    pub code: String,
    pub kind: String,
    pub color: String,
    pub description: String,
    pub criterion: String,
}
pub fn catalog() -> Result<Vec<SkillDefinition>, String> {
    catalog_version(CATALOG_VERSION)
}
pub fn catalog_version(version: u32) -> Result<Vec<SkillDefinition>, String> {
    let raw = match version { 1 => include_str!("skills/catalog-v1.json"), 2 => include_str!("skills/catalog-v2.json"), 3 => include_str!("skills/catalog.json"), _ => return Err("Unsupported skill catalog version".into()) };
    serde_json::from_str(raw).map_err(|e| format!("Invalid skill catalog: {e}"))
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct InputEvidence {
    pub modality: Modality,
    pub suggestion: bool,
    pub scaffold: bool,
    pub revision: bool,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Modality { Text, SpeechTranscript }

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum Outcome { Demonstrated, Partial, NotDemonstrated, NotObserved, Uncertain }
#[derive(Clone, Debug, Serialize, Deserialize, schemars::JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Judgment {
    pub skill_id: String,
    pub outcome: Outcome,
    pub quotes: Vec<String>,
    pub rationale: String,
}
#[derive(Clone, Debug, Serialize, Deserialize, schemars::JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Assessment { pub judgments: Vec<Judgment> }
impl Assessment {
    pub fn validate(&self, source: &str, definitions: &[SkillDefinition]) -> Option<String> {
        let expected: HashSet<&str> = definitions.iter().filter(|s| s.kind == "skill").map(|s| s.id.as_str()).collect();
        let mut seen = HashSet::new();
        for judgment in &self.judgments {
            if !expected.contains(judgment.skill_id.as_str()) {
                return Some(format!("Unknown skill_id {:?}. Use only IDs from the supplied rubrics. Omit unobserved skills.", judgment.skill_id));
            }
            if !seen.insert(judgment.skill_id.as_str()) {
                return Some(format!("Duplicate skill_id {:?}. Return one judgment for this skill, combining its relevant quotes (at most four) and choosing one outcome for the whole attempt. Omit unobserved skills; do not return the entire catalog.", judgment.skill_id));
            }
            if judgment.rationale.trim().is_empty() || judgment.rationale.chars().count() > 500 {
                return Some("Each rationale must contain 1–500 characters.".into());
            }
            if judgment.quotes.len() > 4 || judgment.quotes.iter().any(|q| q.trim().is_empty() || !source.contains(q)) {
                return Some("Quotes must be exact nonempty substrings of the learner's current message; at most four per skill.".into());
            }
            if judgment.outcome == Outcome::NotObserved && !judgment.quotes.is_empty() {
                return Some("Not-observed judgments must have no evidence quotes.".into());
            }
            if matches!(judgment.outcome, Outcome::Demonstrated | Outcome::Partial | Outcome::NotDemonstrated) && judgment.quotes.is_empty() {
                return Some("An observed outcome needs an exact quote from the learner's message.".into());
            }
        }
        // Omitted skills mean not observed; the model returns only relevant judgments.
        None
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Status { Pending, Complete, Failed, Superseded }
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EvidenceRecord {
    pub attempt_id: String,
    pub session_id: String,
    pub turn_id: u64,
    pub message_id: u64,
    pub replaces_message_id: Option<u64>,
    pub chat_id: String,
    pub learner_id: String,
    pub target: String,
    pub native: String,
    pub source: String,
    pub input: InputEvidence,
    pub at_secs: u64,
    pub model: String,
    pub provider_mode: String,
    pub catalog_version: u32,
    pub prompt_version: String,
    pub status: Status,
    pub assessment: Option<Assessment>,
    pub error: Option<String>,
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Ledger { version: u32, records: Vec<EvidenceRecord> }
fn read(chat: &Path) -> Result<Ledger, String> {
    let Some(raw) = crate::persistence::read(&chat.join(FILE))? else { return Ok(Ledger { version: 1, records: vec![] }); };
    let ledger: Ledger = serde_json::from_str(&raw).map_err(|e| format!("Invalid skill evidence in {}: {e}", chat.display()))?;
    if ledger.version != 1 { return Err("Unsupported skill-evidence ledger version.".into()); }
    let mut attempts = HashSet::new();
    for record in &ledger.records {
        if !attempts.insert(&record.attempt_id) || (record.status == Status::Complete && record.assessment.is_none()) || (record.status == Status::Failed && record.error.is_none()) {
            return Err("Invalid skill-evidence attempt state.".into());
        }
        if let Some(assessment) = &record.assessment {
            if let Some(error) = assessment.validate(&record.source, &catalog_version(record.catalog_version)?) { return Err(format!("Invalid saved skill evidence: {error}")); }
        }
    }
    Ok(ledger)
}
fn write(chat: &Path, ledger: &Ledger) -> Result<(), String> {
    crate::persistence::write(&chat.join(FILE), &serde_json::to_vec_pretty(ledger).map_err(|e| e.to_string())?)
}

/// The caller serializes ledger access with the application context lock.
pub fn begin(chat: &Path, record: &EvidenceRecord) -> Result<bool, String> {
    let mut ledger = read(chat)?;
    for old in &mut ledger.records {
        if old.learner_id != record.learner_id || old.target != record.target || old.native != record.native || old.chat_id != record.chat_id {
            return Err("Skill evidence belongs to a different learner or conversation.".into());
        }
        if old.message_id == record.message_id && old.status != Status::Superseded {
            if old.source == record.source && old.input == record.input && old.catalog_version == record.catalog_version && old.prompt_version == record.prompt_version && old.model == record.model && old.provider_mode == record.provider_mode
                && (old.status == Status::Complete || (old.status == Status::Pending && old.session_id == record.session_id)) {
                return Ok(false);
            }
            old.status = Status::Superseded;
        }
    }
    ledger.records.push(record.clone());
    write(chat, &ledger)?;
    Ok(true)
}
pub fn finish(chat: &Path, attempt: &str, result: Result<Assessment, String>) -> Result<bool, String> {
    let mut ledger = read(chat)?;
    let record = ledger.records.iter_mut().find(|r| r.attempt_id == attempt).ok_or("Missing skill evaluation attempt")?;
    if record.status == Status::Superseded { return Ok(false); }
    if record.status != Status::Pending { return Err("Skill evaluation is no longer pending.".into()); }
    match result {
        Ok(assessment) => {
            if let Some(error) = assessment.validate(&record.source, &catalog()?) { return Err(error); }
            record.assessment = Some(assessment);
            record.status = Status::Complete;
        }
        Err(error) => { record.error = Some(error); record.status = Status::Failed; }
    }
    write(chat, &ledger)?;
    Ok(true)
}

fn source_is_live(record: &EvidenceRecord, turns: &[serde_json::Value]) -> bool {
    turns.iter().any(|turn| turn["id"].as_u64() == Some(record.message_id) && turn["user"].as_str() == Some(record.source.as_str()))
}
#[derive(Serialize)]
pub struct Snapshot {
    pub catalog: Vec<SkillDefinition>,
    pub catalog_version: u32,
    pub learner_id: String,
    pub target: String,
    pub conversation_count: usize,
    pub records: Vec<EvidenceRecord>,
}

/// Active evidence is projected against saved source messages. Soft-deleted
/// chats, truncated turns and superseded versions do not contribute.
pub fn snapshot(config: &Path, target: &str) -> Result<Snapshot, String> {
    let mut snapshot = Snapshot { catalog: catalog()?, catalog_version: CATALOG_VERSION, learner_id: LEARNER.into(), target: target.into(), conversation_count: 0, records: vec![] };
    let directory = config.join(crate::conversation::CONVERSATIONS);
    if !directory.try_exists().map_err(|e| e.to_string())? { return Ok(snapshot); }
    for pair in std::fs::read_dir(directory).map_err(|e| e.to_string())? {
        let pair = pair.map_err(|e| e.to_string())?;
        if !pair.file_type().map_err(|e| e.to_string())?.is_dir() { continue; }
        let pair_name = pair.file_name().into_string().map_err(|_| "Invalid language-pair directory name")?;
        if !pair_name.starts_with(&format!("{target}__")) { continue; }
        for chat in crate::conversation::list_chats(&pair.path())? {
            let path = pair.path().join(crate::conversation::CHATS).join(&chat.id);
            let session = crate::conversation::load_session(&path);
            if let Some(error) = session.fault { return Err(error); }
            let turns = session.turns.as_array().ok_or("Conversation has no turn list")?;
            if turns.iter().any(|t| t["user"].as_str().is_some_and(|s| !s.trim().is_empty())) { snapshot.conversation_count += 1; }
            for mut record in read(&path)?.records {
                if record.learner_id != LEARNER || record.target != target || record.chat_id != chat.id || crate::conversation::pair_key(&record.target, &record.native) != pair_name {
                    return Err("Skill evidence ownership does not match its conversation.".into());
                }
                if record.status == Status::Superseded || !source_is_live(&record, turns) { continue; }
                if record.status == Status::Pending && record.session_id != crate::trace::session_id() {
                    record.status = Status::Failed;
                    record.error = Some("Evaluation was interrupted by an app restart; no judgment was recorded.".into());
                }
                snapshot.records.push(record);
            }
        }
    }
    snapshot.records.sort_by_key(|r| std::cmp::Reverse((r.at_secs, r.turn_id)));
    Ok(snapshot)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn assessment(source: &str) -> Assessment {
        Assessment { judgments: catalog().unwrap().into_iter().filter(|s| s.kind == "skill").map(|s| Judgment {
            outcome: if s.id == "referent" { Outcome::Demonstrated } else { Outcome::NotObserved },
            quotes: if s.id == "referent" { vec![source.into()] } else { vec![] },
            skill_id: s.id, rationale: "Test judgment, not semantic validation.".into(),
        }).collect() }
    }
    fn record(source: &str) -> EvidenceRecord {
        EvidenceRecord {
            attempt_id: uuid::Uuid::new_v4().to_string(), session_id: crate::trace::session_id().into(), turn_id: 42, message_id: 7,
            replaces_message_id: None, chat_id: "chat-a".into(), learner_id: LEARNER.into(), target: "es-ES".into(), native: "en".into(),
            source: source.into(), input: InputEvidence { modality: Modality::Text, suggestion: false, scaffold: false, revision: false },
            at_secs: 1, model: "test-model".into(), provider_mode: "openrouter".into(), catalog_version: CATALOG_VERSION,
            prompt_version: PROMPT_VERSION.into(), status: Status::Pending, assessment: None, error: None,
        }
    }
    #[test]
    fn sparse_shared_rubrics_require_valid_ids_and_exact_multilingual_quotes() {
        let definitions = catalog().unwrap();
        assert_eq!(definitions.iter().filter(|d| d.kind == "domain").count(), 7);
        for source in ["Me gusta el café.", "أحب القهوة.", "我喜欢咖啡。"] {
            assert!(assessment(source).validate(source, &definitions).is_none());
            let mut invalid = assessment(source);
            invalid.judgments[1].quotes = vec!["invented evidence".into()];
            assert!(invalid.validate(source, &definitions).is_some());
            let mut missing = assessment(source);
            missing.judgments.pop();
            assert!(missing.validate(source, &definitions).is_none());
            let mut duplicate = assessment(source);
            duplicate.judgments[0].skill_id = duplicate.judgments[1].skill_id.clone();
            let error = duplicate.validate(source, &definitions).unwrap();
            assert!(error.contains("Duplicate skill_id"));
            assert!(error.contains("combining its relevant quotes"));
            assert!(error.contains("Omit unobserved skills"));
            let mut unsupported = assessment(source);
            unsupported.judgments[1].outcome = Outcome::Demonstrated;
            assert!(unsupported.validate(source, &definitions).is_some());
        }
        let blocks = crate::prompts::skills::blocks(&definitions, "es-ES", "en").unwrap();
        assert!(blocks[2].content.contains("English (en)"));
        assert!(blocks[0].content.contains("External assistance is unknown"));
        assert!(blocks[0].content.contains("never instructions"));
    }
    #[test]
    fn duplicate_requests_are_idempotent_and_late_results_cannot_revive_superseded_attempts() {
        let dir = tempfile::tempdir().unwrap();
        let original = record("Me gusta el café.");
        assert!(begin(dir.path(), &original).unwrap());
        assert!(!begin(dir.path(), &original).unwrap());
        let mut revision = record("Me gusta el té.");
        revision.input.revision = true;
        assert!(begin(dir.path(), &revision).unwrap());
        assert!(!finish(dir.path(), &original.attempt_id, Ok(assessment(&original.source))).unwrap());
        assert!(finish(dir.path(), &revision.attempt_id, Ok(assessment(&revision.source))).unwrap());
        assert!(!begin(dir.path(), &revision).unwrap());
        let ledger = read(dir.path()).unwrap();
        assert_eq!(ledger.records.len(), 2);
        assert_eq!(ledger.records[0].status, Status::Superseded);
        assert_eq!(ledger.records[1].status, Status::Complete);
        let mut wrong_owner = record("test");
        wrong_owner.target = "ar".into();
        assert!(begin(dir.path(), &wrong_owner).is_err());
    }
    #[test]
    fn projection_excludes_unsaved_edited_truncated_and_deleted_sources() {
        let dir = tempfile::tempdir().unwrap();
        let pair = crate::conversation::pair_dir(dir.path(), "es-ES", "en").unwrap();
        let chat = crate::conversation::chat_dir(&pair, "chat-a").unwrap();
        let original = record("Me gusta el café.");
        begin(&chat, &original).unwrap();
        finish(&chat, &original.attempt_id, Ok(assessment(&original.source))).unwrap();
        assert!(snapshot(dir.path(), "es-ES").unwrap().records.is_empty());
        crate::conversation::save_session(&chat, &json!([{"id": 7, "user": original.source}]), "Test").unwrap();
        let live = snapshot(dir.path(), "es-ES").unwrap();
        assert_eq!(live.records.len(), 1);
        assert_eq!(live.conversation_count, 1);
        assert!(snapshot(dir.path(), "ar").unwrap().records.is_empty());
        crate::conversation::save_session(&chat, &json!([{"id": 7, "user": "replacement"}]), "Test").unwrap();
        assert!(snapshot(dir.path(), "es-ES").unwrap().records.is_empty());
        crate::conversation::save_session(&chat, &json!([]), "Test").unwrap();
        assert!(snapshot(dir.path(), "es-ES").unwrap().records.is_empty());
        crate::conversation::save_session(&chat, &json!([{"id": 7, "user": original.source}]), "Test").unwrap();
        crate::conversation::delete_chat(&pair, "chat-a").unwrap();
        assert!(snapshot(dir.path(), "es-ES").unwrap().records.is_empty());
        assert!(chat.join(FILE).exists(), "soft deletion retains its evidence file");
    }
    #[test]
    fn target_aggregation_keeps_native_context_and_rejects_corrupt_ownership() {
        let dir = tempfile::tempdir().unwrap();
        for native in ["en", "ar"] {
            let pair = crate::conversation::pair_dir(dir.path(), "es-ES", native).unwrap();
            let chat = crate::conversation::chat_dir(&pair, "chat-a").unwrap();
            let mut attempt = record("Me gusta el café.");
            attempt.native = native.into();
            begin(&chat, &attempt).unwrap();
            finish(&chat, &attempt.attempt_id, Ok(assessment(&attempt.source))).unwrap();
            crate::conversation::save_session(&chat, &json!([{"id": 7, "user": attempt.source}]), "Test").unwrap();
        }
        assert_eq!(snapshot(dir.path(), "es-ES").unwrap().records.len(), 2);
        let pair = crate::conversation::pair_dir(dir.path(), "es-ES", "en").unwrap();
        let chat = crate::conversation::chat_dir(&pair, "chat-a").unwrap();
        let mut ledger = read(&chat).unwrap();
        ledger.records[0].learner_id = "someone-else".into();
        write(&chat, &ledger).unwrap();
        assert!(snapshot(dir.path(), "es-ES").is_err());
    }
    #[test]
    fn progress_cannot_credit_another_target_language() {
        let dir = tempfile::tempdir().unwrap();
        let mut view = snapshot(dir.path(), "es-ES").unwrap();
        let mut attempt = record("That cup.");
        attempt.status = Status::Complete;
        attempt.assessment = Some(assessment(&attempt.source));
        view.records = vec![attempt];
        assert_eq!(progress::project(&view, progress::Choices::initial("es-ES")).unwrap().xp, 10);
        view.records[0].target = "ar".into();
        assert!(progress::project(&view, progress::Choices::initial("es-ES")).err().unwrap().contains("another language"));
        assert!(snapshot(dir.path(), "fr").unwrap().records.is_empty());
    }

    #[test]
    fn progression_is_deduplicated_assistance_aware_and_reversible() {
        let dir = tempfile::tempdir().unwrap();
        let mut view = snapshot(dir.path(), "es-ES").unwrap();
        let mut first = record("That cup.");
        first.status = Status::Complete;
        first.assessment = Some(assessment(&first.source));
        view.records = vec![first.clone(), first.clone()];
        let choices = progress::Choices::initial("es-ES");
        let one = progress::project(&view, choices.clone()).unwrap();
        assert_eq!(one.xp, 10);
        assert_eq!(one.credits.len(), 1);
        assert_eq!(one.credits[0].attempt_id, first.attempt_id);
        assert_eq!(one.credits[0].xp, 10);
        assert_eq!(one.skills.iter().find(|s| s.skill_id == "referent").unwrap().successes, 1);
        for source in ["That book.", "That person."] {
            let mut next = first.clone();
            next.attempt_id = uuid::Uuid::new_v4().to_string();
            next.source = source.into();
            next.assessment = Some(assessment(source));
            view.records.push(next);
        }
        let three = progress::project(&view, choices.clone()).unwrap();
        assert!(three.skills.iter().find(|s| s.skill_id == "referent").unwrap().star);
        assert!(three.branches.iter().find(|s| s.skill_id == "track_referents").unwrap().available);
        assert_eq!(three.xp, 30);
        let mut excluded = choices.clone();
        excluded.excluded_attempts.push(first.attempt_id.clone());
        assert_eq!(progress::project(&view, excluded).unwrap().xp, 20);
        view.records.iter_mut().for_each(|r| r.input.suggestion = true);
        let supported = progress::project(&view, choices.clone()).unwrap();
        assert_eq!(supported.xp, 6);
        assert_eq!(supported.credits.iter().map(|c| c.xp).sum::<usize>(), supported.xp);
        assert!(!supported.skills.iter().any(|s| s.star));
        view.records.clear();
        assert_eq!(progress::project(&view, choices).unwrap().xp, 0);
    }
    #[test]
    fn credit_ownership_prefers_unassisted_and_is_order_independent() {
        let dir = tempfile::tempdir().unwrap();
        let mut view = snapshot(dir.path(), "es-ES").unwrap();
        let mut assisted = record("That cup.");
        assisted.attempt_id = "assisted".into();
        assisted.status = Status::Complete;
        assisted.input.suggestion = true;
        assisted.assessment = Some(assessment(&assisted.source));
        let mut direct = assisted.clone();
        direct.attempt_id = "direct".into();
        direct.input.suggestion = false;
        let mut duplicate = direct.clone();
        duplicate.attempt_id = "duplicate".into();
        duplicate.at_secs += 1;
        view.records = vec![duplicate, assisted, direct];
        let choices = progress::Choices::initial("es-ES");
        let projected = progress::project(&view, choices.clone()).unwrap();
        assert_eq!(projected.xp, 10);
        assert_eq!(projected.credits.len(), 1);
        assert_eq!(projected.credits[0].attempt_id, "direct");
        view.records.reverse();
        assert_eq!(progress::project(&view, choices.clone()).unwrap().credits[0].attempt_id, "direct");
        let mut excluded = choices;
        excluded.excluded_attempts = vec!["direct".into(), "duplicate".into()];
        let projected = progress::project(&view, excluded).unwrap();
        assert_eq!(projected.xp, 2);
        assert_eq!(projected.credits[0].attempt_id, "assisted");
        assert_eq!(projected.credits[0].xp, 2);
    }
    #[test]
    fn historical_rubrics_remain_readable_without_new_skill_credit() {
        let dir = tempfile::tempdir().unwrap();
        let pair = crate::conversation::pair_dir(dir.path(), "es-ES", "en").unwrap();
        let chat = crate::conversation::chat_dir(&pair, "chat-a").unwrap();
        let mut old = record("Me gusta el café.");
        old.catalog_version = 1;
        old.status = Status::Complete;
        old.assessment = Some(Assessment { judgments: vec![Judgment { skill_id: "preference".into(), outcome: Outcome::Demonstrated, quotes: vec![old.source.clone()], rationale: "Legacy preference evidence.".into() }] });
        write(&chat, &Ledger { version: 1, records: vec![old.clone()] }).unwrap();
        crate::conversation::save_session(&chat, &json!([{"id": 7, "user": old.source}]), "Test").unwrap();
        let view = snapshot(dir.path(), "es-ES").unwrap();
        assert_eq!(view.records.len(), 1);
        assert_eq!(progress::project(&view, progress::Choices::initial("es-ES")).unwrap().xp, 0);
        assert!(catalog_version(99).is_err());
    }
    #[test]
    fn failures_and_interrupted_evaluations_are_visible() {
        let dir = tempfile::tempdir().unwrap();
        let pair = crate::conversation::pair_dir(dir.path(), "es-ES", "en").unwrap();
        let chat = crate::conversation::chat_dir(&pair, "chat-a").unwrap();
        let mut attempt = record("Me gusta el café.");
        attempt.session_id = "previous-process".into();
        begin(&chat, &attempt).unwrap();
        crate::conversation::save_session(&chat, &json!([{"id": 7, "user": attempt.source}]), "Test").unwrap();
        let interrupted = snapshot(dir.path(), "es-ES").unwrap();
        assert_eq!(interrupted.records[0].status, Status::Failed);
        assert!(interrupted.records[0].error.as_ref().unwrap().contains("interrupted"));
        finish(&chat, &attempt.attempt_id, Err("provider unavailable".into())).unwrap();
        let failed = snapshot(dir.path(), "es-ES").unwrap();
        assert_eq!(failed.records[0].error.as_deref(), Some("provider unavailable"));
        assert!(failed.records[0].assessment.is_none());
        crate::persistence::write(&chat.join(FILE), b"not json").unwrap();
        assert!(snapshot(dir.path(), "es-ES").is_err());
    }
}
