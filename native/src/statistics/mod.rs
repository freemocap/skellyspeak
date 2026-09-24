use crate::model::*;
use crate::storage::store::Store;
use rusqlite::{Connection, params};
fn summary(
    db: &Connection,
    id: &str,
    label: &str,
    language: Option<&str>,
    persona: Option<&str>,
) -> Result<UsageSummary> {
    let predicate = "(?1 IS NULL OR c.language_id=?1) AND (?2 IS NULL OR r.persona_id=?2)";
    let conversations=db.query_row(&format!("SELECT count(*) FROM conversations c JOIN contacts r ON r.id=c.contact_id WHERE {predicate}"),params![language,persona],|r|r.get(0))?;
    let (learner_messages,persona_messages)=db.query_row(&format!("SELECT COALESCE(SUM(m.role='user'),0),COALESCE(SUM(m.role='assistant'),0) FROM messages m JOIN conversations c ON c.id=m.conversation_id JOIN contacts r ON r.id=c.contact_id WHERE EXISTS(SELECT 1 FROM operations o WHERE o.turn_id=m.turn_id AND o.kind='persona_reply') AND {predicate}"),params![language,persona],|r|Ok((r.get(0)?,r.get(1)?)))?;
    let (attempts,input_tokens,output_tokens,unknown_usage): (i32,i32,i32,i32)=db.query_row(&format!("SELECT count(*),COALESCE(SUM(a.input_tokens),0),COALESCE(SUM(a.output_tokens),0),COALESCE(SUM(a.input_tokens IS NULL OR a.output_tokens IS NULL),0) FROM attempts a JOIN operations o ON o.id=a.operation_id JOIN turns t ON t.id=o.turn_id JOIN conversations c ON c.id=t.conversation_id JOIN contacts r ON r.id=c.contact_id WHERE a.requested_model!='local' AND NOT EXISTS(SELECT 1 FROM inference_consumers u WHERE u.consumer_id=a.id) AND {predicate}"),params![language,persona],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?)))?;
    // A recording belongs to a conversation or to a drill item. Both count
    // toward global and language usage; only a conversation has a partner, so a
    // partner-scoped report never attributes a drill recording to one.
    let audio: i32 = db.query_row("SELECT count(*) FROM transcription_attempts a LEFT JOIN conversations c ON c.id=a.conversation_id LEFT JOIN contacts r ON r.id=c.contact_id LEFT JOIN drill_items d ON d.id=a.drill_item_id WHERE (?1 IS NULL OR COALESCE(c.language_id,d.language_id)=?1) AND (?2 IS NULL OR r.persona_id=?2)", params![language,persona], |r| r.get(0))?;
    // Proposals belong to a language and workspace, not an existing persona.
    let generation = if persona.is_none() {
        crate::ai::generation::generation_receipts::usage(db, language)?
    } else {
        PersonaGenerationUsage::default()
    };
    // Explicit reading requests (word meanings, read-aloud, translation) belong
    // to a language, not a partner. Only submitted requests can incur usage.
    let (reading_attempts, reading_input, reading_output, reading_unknown): (i32, i32, i32, i32) =
        if persona.is_none() {
            db.query_row("SELECT count(*),COALESCE(SUM(json_extract(receipt,'$.response.inputTokens')),0),COALESCE(SUM(json_extract(receipt,'$.response.outputTokens')),0),COALESCE(SUM(json_extract(receipt,'$.response.inputTokens') IS NULL OR json_extract(receipt,'$.response.outputTokens') IS NULL),0) FROM reading_attempts WHERE json_extract(receipt,'$.dispatchedAt') IS NOT NULL AND (?1 IS NULL OR json_extract(receipt,'$.language')=?1)", params![language], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)))?
        } else {
            (0, 0, 0, 0)
        };
    // Shared paid executions count once, even when several consumer receipts refer to them.
    let (shared_attempts,shared_input,shared_output,shared_unknown): (i32,i32,i32,i32) = db.query_row(
        "SELECT count(*),COALESCE(SUM(json_extract(e.metadata,'$.inputTokens')),0),COALESCE(SUM(json_extract(e.metadata,'$.outputTokens')),0),COALESCE(SUM(json_extract(e.metadata,'$.inputTokens') IS NULL OR json_extract(e.metadata,'$.outputTokens') IS NULL),0) FROM inference_executions e WHERE e.dispatched=1 AND ((?1 IS NULL AND ?2 IS NULL) OR EXISTS(SELECT 1 FROM inference_consumers u LEFT JOIN reading_attempts reading ON reading.id=u.consumer_id LEFT JOIN attempts a ON a.id=u.consumer_id LEFT JOIN operations o ON o.id=a.operation_id LEFT JOIN turns t ON t.id=o.turn_id LEFT JOIN conversations c ON c.id=t.conversation_id LEFT JOIN contacts r ON r.id=c.contact_id WHERE u.execution_id=e.id AND (?1 IS NULL OR COALESCE(c.language_id,json_extract(reading.receipt,'$.language'))=?1) AND (?2 IS NULL OR r.persona_id=?2)))",
        params![language,persona],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?)))?;
    Ok(UsageSummary {
        id: id.into(),
        label: label.into(),
        conversations,
        learner_messages,
        persona_messages,
        attempts: attempts + audio + generation.attempts + reading_attempts + shared_attempts,
        input_tokens: input_tokens + generation.input_tokens + reading_input + shared_input,
        output_tokens: output_tokens + generation.output_tokens + reading_output + shared_output,
        unknown_usage: unknown_usage
            + audio
            + generation.unknown_usage
            + reading_unknown
            + shared_unknown,
    })
}
impl Store {
    pub fn profile(&self) -> Result<ProfileSnapshot> {
        let snapshot = self.snapshot()?;
        let db = &self.connection;
        let global = summary(db, "global", "All retained activity", None, None)?;
        let languages = snapshot
            .languages
            .iter()
            .map(|language| summary(db, &language.id, &language.name, Some(&language.id), None))
            .collect::<Result<Vec<_>>>()?;
        let personas = snapshot
            .personas
            .iter()
            .map(|persona| {
                summary(
                    db,
                    &persona.id,
                    &persona.details.name,
                    None,
                    Some(&persona.id),
                )
            })
            .collect::<Result<Vec<_>>>()?;
        Ok(ProfileSnapshot {
            revision: snapshot.revision,
            global,
            languages,
            personas,
        })
    }
}
