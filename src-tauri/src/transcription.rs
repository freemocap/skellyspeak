//! Metadata-only receipts for volatile audio. No replayable audio or transcript store.
#[cfg(any(desktop, test))]
use crate::access::ResolvedTarget;
use crate::model::*;
use rusqlite::{Connection, params};

#[cfg(any(desktop, test))]
pub fn permitted(db: &Connection, conversation: &str, target: &ResolvedTarget) -> Result<()> {
    let valid: bool = db.query_row("SELECT EXISTS(SELECT 1 FROM conversations c JOIN relationships r ON r.id=c.relationship_id WHERE c.id=?1 AND c.archived=0 AND r.archived=0)", [conversation], |r| r.get(0))?;
    if !valid || crate::execution::config(db)?.revision != target.revision {
        return Err(AppError::new(
            ErrorCode::Conflict,
            "The conversation or AI connection changed. Transcription cannot be inserted.",
        ));
    }
    Ok(())
}

#[cfg(any(desktop, test))]
pub fn begin(db: &Connection, id: &str, conversation: &str, target: &ResolvedTarget) -> Result<()> {
    permitted(db, conversation, target)?;
    crate::holds::check(db, target)?;
    if crate::execution::config(db)?.paused {
        return Err(AppError::new(
            ErrorCode::AdmissionHeld,
            "AI execution is paused. This recording was not submitted.",
        ));
    }
    // Duplicate invocation cannot authorize another network request.
    db.execute("INSERT INTO transcription_attempts(id,conversation_id,route,model,profile_revision,state) VALUES(?1,?2,?3,?4,?5,'running')",
        params![id, conversation, target.route.label(), target.model, target.revision])?;
    db.execute("UPDATE metadata SET revision=revision+1", [])?;
    Ok(())
}

#[cfg(any(desktop, test))]
pub fn finish(
    db: &Connection,
    id: &str,
    conversation: &str,
    target: &ResolvedTarget,
    result: Result<String>,
) -> Result<Result<String>> {
    let result = match permitted(db, conversation, target) {
        Ok(()) => result,
        Err(error) if error.code == ErrorCode::Conflict => Err(AppError::new(
            ErrorCode::UnknownOutcome,
            "Transcription stopped because its connection or conversation changed. Provider processing and cost may continue; no transcript was inserted.",
        )),
        Err(error) => return Err(error),
    };
    let (state, error) = match &result {
        Ok(_) => ("succeeded", None),
        Err(error) => (
            if error.code == ErrorCode::UnknownOutcome {
                "unknown"
            } else {
                "failed"
            },
            Some(error.message.as_str()),
        ),
    };
    let changed = db.execute("UPDATE transcription_attempts SET state=?2,error=?3,finished_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?1 AND conversation_id=?4 AND state='running'",
        params![id, state, error, conversation])?;
    if changed != 1 {
        return Err(AppError::new(
            ErrorCode::Conflict,
            "Transcription receipt is no longer active. No transcript was inserted.",
        ));
    }
    db.execute("UPDATE metadata SET revision=revision+1", [])?;
    Ok(result)
}

#[cfg(any(desktop, test))]
impl crate::store::Store {
    pub fn begin_transcription(
        &mut self,
        id: &str,
        conversation: &str,
        target: &ResolvedTarget,
    ) -> Result<()> {
        let tx = self.connection.transaction()?;
        begin(&tx, id, conversation, target)?;
        tx.commit()?;
        Ok(())
    }
    pub fn finish_transcription(
        &mut self,
        id: &str,
        conversation: &str,
        target: &ResolvedTarget,
        result: Result<String>,
    ) -> Result<String> {
        let tx = self.connection.transaction()?;
        let result = finish(&tx, id, conversation, target, result)?;
        tx.commit()?;
        result
    }
}

pub fn views(db: &Connection, conversation: &str) -> Result<Vec<TranscriptionAttempt>> {
    let rows = db.prepare("SELECT id,route,model,state,started_at,finished_at,error FROM transcription_attempts WHERE conversation_id=?1 ORDER BY rowid DESC LIMIT 50")?
        .query_map([conversation], |r| Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?,r.get::<_,String>(2)?,r.get::<_,String>(3)?,r.get::<_,String>(4)?,r.get::<_,Option<String>>(5)?,r.get::<_,Option<String>>(6)?)))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    rows.into_iter()
        .map(
            |(id, route, model, state, started_at, finished_at, error)| {
                Ok(TranscriptionAttempt {
                    id,
                    route: ConnectionRoute::parse(&route)?,
                    model,
                    state,
                    started_at,
                    finished_at,
                    error,
                })
            },
        )
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::Store;
    fn setup() -> (tempfile::TempDir, Store, String, ResolvedTarget) {
        let dir = tempfile::tempdir().unwrap();
        let mut store = Store::open(&dir.path().join("audio.sqlite3")).unwrap();
        store.prepare_chat().unwrap();
        store
            .connection
            .execute("UPDATE ai_config SET route='openrouter'", [])
            .unwrap();
        store
            .set_connection(1, Some("chat-reference"), "standard", "fast")
            .unwrap();
        store
            .connection
            .execute(
                "UPDATE ai_config SET groq_credential_id='audio-reference'",
                [],
            )
            .unwrap();
        let conversation = store.snapshot().unwrap().conversations[0].id.clone();
        let target =
            crate::access::resolve(&store.connection, crate::access::Capability::Transcription)
                .unwrap();
        (dir, store, conversation, target)
    }
    #[test]
    fn receipt_is_single_use_usage_is_unknown_and_text_is_not_retained() {
        let (_dir, mut store, conversation, target) = setup();
        store
            .begin_transcription("recording", &conversation, &target)
            .unwrap();
        assert!(
            store
                .begin_transcription("recording", &conversation, &target)
                .is_err()
        );
        assert_eq!(
            store
                .finish_transcription(
                    "recording",
                    &conversation,
                    &target,
                    Ok("Private speech".into())
                )
                .unwrap(),
            "Private speech"
        );
        assert!(
            store
                .finish_transcription("recording", &conversation, &target, Ok("Duplicate".into()))
                .is_err()
        );
        let records = views(&store.connection, &conversation).unwrap();
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].state, "succeeded");
        assert!(
            !serde_json::to_string(&records)
                .unwrap()
                .contains("Private speech")
        );
        assert!(
            store
                .conversation_snapshot(&conversation, None)
                .unwrap()
                .messages
                .is_empty()
        );
        let stats = store.profile().unwrap();
        assert_eq!(stats.global.attempts, 1);
        assert_eq!(stats.global.unknown_usage, 1);
        assert_eq!(stats.global.input_tokens, 0);
        let revision = store.snapshot().unwrap().conversations[0].revision;
        store
            .execute(Command {
                session_id: store.session_id.clone(),
                action_id: uuid::Uuid::new_v4().to_string(),
                action: Action::DeleteConversation {
                    conversation_id: conversation,
                    expected_revision: revision,
                },
            })
            .unwrap();
        assert_eq!(store.profile().unwrap().global.attempts, 0);
    }
    #[test]
    fn archived_owner_or_deleted_source_cannot_publish_or_recreate_receipts() {
        let (_dir, mut store, conversation, target) = setup();
        store
            .begin_transcription("archived", &conversation, &target)
            .unwrap();
        store
            .connection
            .execute("UPDATE relationships SET archived=1", [])
            .unwrap();
        assert!(
            store
                .finish_transcription("archived", &conversation, &target, Ok("Late speech".into()))
                .is_err()
        );
        assert_eq!(
            views(&store.connection, &conversation).unwrap()[0].state,
            "unknown"
        );
        store
            .connection
            .execute("UPDATE relationships SET archived=0", [])
            .unwrap();
        store
            .begin_transcription("deleted", &conversation, &target)
            .unwrap();
        let revision = store.snapshot().unwrap().conversations[0].revision;
        store
            .execute(Command {
                session_id: store.session_id.clone(),
                action_id: uuid::Uuid::new_v4().to_string(),
                action: Action::DeleteConversation {
                    conversation_id: conversation.clone(),
                    expected_revision: revision,
                },
            })
            .unwrap();
        assert!(
            store
                .finish_transcription("deleted", &conversation, &target, Ok("Late speech".into()))
                .is_err()
        );
        assert!(views(&store.connection, &conversation).unwrap().is_empty());
    }

    #[test]
    fn interrupted_audio_stays_unknown_across_restarts_without_replay() {
        let (dir, mut store, conversation, target) = setup();
        store
            .begin_transcription("recording", &conversation, &target)
            .unwrap();
        drop(store);
        for _ in 0..2 {
            let store = Store::open(&dir.path().join("audio.sqlite3")).unwrap();
            let records = views(&store.connection, &conversation).unwrap();
            assert_eq!(records.len(), 1);
            assert_eq!(records[0].state, "unknown");
            assert!(records[0].finished_at.is_some());
        }
    }
    #[test]
    fn changed_target_defeats_publication_and_pause_prevents_dispatch() {
        let (_dir, mut store, conversation, target) = setup();
        store
            .connection
            .execute("UPDATE ai_config SET paused=1", [])
            .unwrap();
        assert!(
            store
                .begin_transcription("paused", &conversation, &target)
                .is_err()
        );
        assert!(views(&store.connection, &conversation).unwrap().is_empty());
        store
            .connection
            .execute("UPDATE ai_config SET paused=0", [])
            .unwrap();
        store
            .begin_transcription("recording", &conversation, &target)
            .unwrap();
        store
            .connection
            .execute("UPDATE ai_config SET revision=revision+1", [])
            .unwrap();
        assert_eq!(
            store
                .finish_transcription(
                    "recording",
                    &conversation,
                    &target,
                    Ok("Late speech".into())
                )
                .unwrap_err()
                .code,
            ErrorCode::UnknownOutcome
        );
        assert_eq!(
            views(&store.connection, &conversation).unwrap()[0].state,
            "unknown"
        );
    }
}
