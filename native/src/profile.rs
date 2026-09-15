use crate::{model::*, store::Store};
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
    let (attempts,input_tokens,output_tokens,unknown_usage): (i32,i32,i32,i32)=db.query_row(&format!("SELECT count(*),COALESCE(SUM(a.input_tokens),0),COALESCE(SUM(a.output_tokens),0),COALESCE(SUM(a.input_tokens IS NULL OR a.output_tokens IS NULL),0) FROM attempts a JOIN operations o ON o.id=a.operation_id JOIN turns t ON t.id=o.turn_id JOIN conversations c ON c.id=t.conversation_id JOIN contacts r ON r.id=c.contact_id WHERE a.requested_model!='local' AND {predicate}"),params![language,persona],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?)))?;
    let audio: i32 = db.query_row(&format!("SELECT count(*) FROM transcription_attempts a JOIN conversations c ON c.id=a.conversation_id JOIN contacts r ON r.id=c.contact_id WHERE {predicate}"), params![language,persona], |r| r.get(0))?;
    // Proposals belong to a language and workspace, not an existing persona.
    let generation = if persona.is_none() {
        crate::generation_receipts::usage(db, language)?
    } else {
        PersonaGenerationUsage::default()
    };
    Ok(UsageSummary {
        id: id.into(),
        label: label.into(),
        conversations,
        learner_messages,
        persona_messages,
        attempts: attempts + audio + generation.attempts,
        input_tokens: input_tokens + generation.input_tokens,
        output_tokens: output_tokens + generation.output_tokens,
        unknown_usage: unknown_usage + audio + generation.unknown_usage,
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
