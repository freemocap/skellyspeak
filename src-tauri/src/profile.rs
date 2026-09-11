use crate::{model::*, store::Store};
use rusqlite::{Connection, params};
fn summary(
    db: &Connection,
    id: &str,
    label: &str,
    language: Option<&str>,
    partner: Option<&str>,
) -> Result<UsageSummary> {
    let predicate = "(?1 IS NULL OR c.language_id=?1) AND (?2 IS NULL OR r.partner_id=?2)";
    let conversations=db.query_row(&format!("SELECT count(*) FROM conversations c JOIN relationships r ON r.id=c.relationship_id WHERE {predicate}"),params![language,partner],|r|r.get(0))?;
    let (learner_messages,partner_messages)=db.query_row(&format!("SELECT COALESCE(SUM(m.role='user'),0),COALESCE(SUM(m.role='assistant'),0) FROM messages m JOIN conversations c ON c.id=m.conversation_id JOIN relationships r ON r.id=c.relationship_id WHERE EXISTS(SELECT 1 FROM operations o WHERE o.turn_id=m.turn_id AND o.kind='partner_reply') AND {predicate}"),params![language,partner],|r|Ok((r.get(0)?,r.get(1)?)))?;
    let (attempts,input_tokens,output_tokens,unknown_usage): (i32,i32,i32,i32)=db.query_row(&format!("SELECT count(*),COALESCE(SUM(a.input_tokens),0),COALESCE(SUM(a.output_tokens),0),COALESCE(SUM(a.input_tokens IS NULL OR a.output_tokens IS NULL),0) FROM attempts a JOIN operations o ON o.id=a.operation_id JOIN turns t ON t.id=o.turn_id JOIN conversations c ON c.id=t.conversation_id JOIN relationships r ON r.id=c.relationship_id WHERE a.requested_model!='local' AND {predicate}"),params![language,partner],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?)))?;
    let audio: i32 = db.query_row(&format!("SELECT count(*) FROM transcription_attempts a JOIN conversations c ON c.id=a.conversation_id JOIN relationships r ON r.id=c.relationship_id WHERE {predicate}"), params![language,partner], |r| r.get(0))?;
    Ok(UsageSummary {
        id: id.into(),
        label: label.into(),
        conversations,
        learner_messages,
        partner_messages,
        attempts: attempts + audio,
        input_tokens,
        output_tokens,
        unknown_usage: unknown_usage + audio,
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
        let partners = snapshot
            .partners
            .iter()
            .map(|partner| {
                summary(
                    db,
                    &partner.id,
                    &partner.details.name,
                    None,
                    Some(&partner.id),
                )
            })
            .collect::<Result<Vec<_>>>()?;
        Ok(ProfileSnapshot {
            revision: snapshot.revision,
            global,
            languages,
            partners,
        })
    }
}
