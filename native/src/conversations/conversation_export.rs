//! Explicit, read-only conversation projections. Never serialize native context or
//! connection configuration; every exported field is selected deliberately.
use crate::model::*;
use crate::storage::store::Store;
use rusqlite::{Connection, OptionalExtension};
use serde::Serialize;
use serde_json::{Value, json};
use std::{path::Path, sync::Arc};

#[derive(Serialize)]
struct Document {
    schema: &'static str,
    version: u32,
    options: Options,
    conversation: Value,
    messages: Vec<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    coach: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    backend: Option<Vec<Value>>,
}
#[derive(Serialize)]
struct Options {
    include_coach: bool,
    include_backend: bool,
}

fn rows(db: &Connection, sql: &str, conversation: &str) -> Result<Vec<Value>> {
    db.prepare(sql)?
        .query_map([conversation], |row| row.get::<_, String>(0))?
        .map(|row| Ok(serde_json::from_str(&row?)?))
        .collect()
}

fn render(
    store: &Store,
    conversation: &str,
    include_coach: bool,
    include_backend: bool,
) -> Result<String> {
    let db = &store.connection;
    // Application owns Store's mutex throughout the projection; no executor can
    // publish between these reads. No UI page size or cursor limits this export.
    let metadata:Option<String>=db.query_row("SELECT json_object('id',c.id,'title',c.title,'language',c.language_id,'persona_name',json_extract(p.details,'$.name'),'created_at',c.created_at) FROM conversations c JOIN contacts r ON r.id=c.contact_id JOIN personas p ON p.id=r.persona_id WHERE c.id=?1",[conversation],|row|row.get(0)).optional()?;
    let metadata = metadata
        .ok_or_else(|| AppError::new(ErrorCode::NotFound, "Conversation no longer exists."))?;
    let messages = rows(
        db,
        "SELECT json_object('id',m.id,'turn_id',m.turn_id,'sequence',m.sequence,'role',m.role,'text',m.text,'created_at',m.created_at) FROM messages m WHERE m.conversation_id=?1 AND NOT EXISTS(SELECT 1 FROM turns child WHERE child.replaces_turn_id=m.turn_id) AND EXISTS(SELECT 1 FROM operations o WHERE o.turn_id=m.turn_id AND o.kind IN ('persona_reply','persona_opening')) ORDER BY m.sequence",
        conversation,
    )?;
    let coach = if include_coach {
        let thread = rows(
            db,
            "SELECT json_object('id',m.id,'turn_id',m.turn_id,'sequence',m.sequence,'role',m.role,'text',m.text,'created_at',m.created_at) FROM messages m WHERE m.conversation_id=?1 AND NOT EXISTS(SELECT 1 FROM turns child WHERE child.replaces_turn_id=m.turn_id) AND EXISTS(SELECT 1 FROM operations o WHERE o.turn_id=m.turn_id AND o.kind='coach_reply') ORDER BY m.sequence",
            conversation,
        )?;
        let contexts = rows(
            db,
            "SELECT json_object('turn_id',t.id,'coachObservation',json_extract(t.context,'$.coachObservation'),'candidateConstructs',json_extract(t.context,'$.candidateConstructs'),'coachDecision',json_extract(t.context,'$.coachDecision')) FROM turns t WHERE t.conversation_id=?1 AND NOT EXISTS(SELECT 1 FROM turns child WHERE child.replaces_turn_id=t.id) AND (json_type(t.context,'$.coachObservation')='object' OR json_type(t.context,'$.coachDecision')='object') ORDER BY t.rowid",
            conversation,
        )?;
        let mut feedback = vec![];
        for context in contexts {
            // Reuse the public observation projection; hidden target hypotheses
            // and error rationales do not become visible through export.
            let observation = if context["coachObservation"].is_null() {
                None
            } else {
                crate::learning::coaching::coach_policy::view(&context)?
            };
            let decision: Option<crate::learning::coaching::CoachDecision> =
                if context["coachDecision"].is_null() {
                    None
                } else {
                    Some(serde_json::from_value(context["coachDecision"].clone())?)
                };
            feedback.push(
                json!({"turn_id":context["turn_id"],"observation":observation,"decision":decision}),
            );
        }
        Some(json!({"messages":thread,"feedback":feedback}))
    } else {
        None
    };
    let backend = if include_backend {
        let mut turns = rows(
            db,
            "SELECT json_object('id',t.id,'state',t.state,'paused',json(CASE WHEN t.paused THEN 'true' ELSE 'false' END),'route',t.route,'model',t.model,'created_at',t.created_at,'provenance',json_object('config_hash',json_extract(t.context,'$.configHash'),'construct_registry_hash',json_extract(t.context,'$.constructRegistryHash'),'catalog_version',json_extract(t.context,'$.catalogVersion'),'template_version',json_extract(t.context,'$.templateVersion'),'feedback_prompt_version',json_extract(t.context,'$.coachFeedbackPromptVersion'),'suggestions_prompt_version',json_extract(t.context,'$.coachSuggestionsPromptVersion'),'settings_revision',json_extract(t.context,'$.settingsRevision'),'persona_revision',json_extract(t.context,'$.personaRevision'))) FROM turns t WHERE t.conversation_id=?1 AND NOT EXISTS(SELECT 1 FROM turns child WHERE child.replaces_turn_id=t.id) ORDER BY t.rowid",
            conversation,
        )?;
        for turn in &mut turns {
            let id = turn["id"].as_str().ok_or_else(|| {
                AppError::new(ErrorCode::Storage, "Export turn identity is missing.")
            })?;
            let operations = rows(
                db,
                "SELECT json_object('id',o.id,'kind',o.kind,'state',o.state) FROM operations o WHERE o.turn_id=?1 ORDER BY o.rowid",
                id,
            )?;
            let attempts = rows(
                db,
                "SELECT json_object('id',a.id,'operation_id',a.operation_id,'state',a.state,'requested_model',a.requested_model,'actual_model',a.actual_model,'started_at',a.started_at,'finished_at',a.finished_at,'input_tokens',a.input_tokens,'output_tokens',a.output_tokens,'has_error',json(CASE WHEN a.error IS NULL THEN 'false' ELSE 'true' END)) FROM attempts a JOIN operations o ON o.id=a.operation_id WHERE o.turn_id=?1 ORDER BY a.rowid",
                id,
            )?;
            turn["operations"] = json!(operations);
            turn["attempts"] = json!(attempts);
        }
        Some(turns)
    } else {
        None
    };
    serde_yaml_ng::to_string(&Document {
        schema: "skellyspeak.conversation",
        version: 1,
        options: Options {
            include_coach,
            include_backend,
        },
        conversation: serde_json::from_str(&metadata)?,
        messages,
        coach,
        backend,
    })
    .map_err(|e| {
        AppError::new(
            ErrorCode::Storage,
            format!("Could not serialize conversation: {e}"),
        )
    })
}

#[tauri::command]
pub(crate) fn view_conversation_yaml(
    state: tauri::State<'_, Arc<crate::application::Application>>,
    conversation_id: String,
    include_coach: bool,
    include_backend: bool,
) -> Result<String> {
    render(
        &*state.lock()?,
        &conversation_id,
        include_coach,
        include_backend,
    )
}
#[tauri::command]
pub(crate) fn save_conversation_yaml(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<crate::application::Application>>,
    conversation_id: String,
    include_coach: bool,
    include_backend: bool,
) -> Result<String> {
    use tauri::Manager;
    let yaml = render(
        &*state.lock()?,
        &conversation_id,
        include_coach,
        include_backend,
    )?;
    let downloads = app.path().download_dir().map_err(|e| {
        AppError::new(
            ErrorCode::Storage,
            format!("Could not locate Downloads: {e}"),
        )
    })?;
    let path = downloads.join(format!(
        "skellyspeak-conversation-{}.yaml",
        uuid::Uuid::new_v4()
    ));
    write_new(&path, &yaml)?;
    Ok(path.display().to_string())
}
fn write_new(path: &Path, yaml: &str) -> Result<()> {
    use std::io::Write;
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(path).map_err(|e| {
        AppError::new(
            ErrorCode::Storage,
            format!("Could not create conversation file: {e}"),
        )
    })?;
    file.write_all(yaml.as_bytes())
        .and_then(|_| file.sync_all())
        .map_err(|e| {
            AppError::new(
                ErrorCode::Storage,
                format!("Conversation file could not be completed: {e}"),
            )
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::params;
    fn fixture() -> (tempfile::TempDir, Store, String) {
        let dir = tempfile::tempdir().unwrap();
        let mut store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
        store.prepare_chat().unwrap();
        let conversation = store.snapshot().unwrap().conversations[0].id.clone();
        (dir, store, conversation)
    }
    fn turn(store: &Store, conversation: &str, index: i32, kind: &str, text: &str) -> String {
        let id = format!("turn-{conversation}-{index}");
        store.connection.execute("INSERT INTO turns(id,conversation_id,state,paused,profile_revision,credential_id,route,model,context) VALUES(?1,?2,'succeeded',0,1,'SECRET_CREDENTIAL','custom','fixture-model',?3)",params![id,conversation,json!({"messages":[{"role":"system","content":"SECRET_PROMPT"}],"customEndpoint":"https://SECRET_ENDPOINT","configHash":"fixture-hash"}).to_string()]).unwrap();
        store
            .connection
            .execute(
                "INSERT INTO operations(id,turn_id,kind,state) VALUES(?1,?2,?3,'succeeded')",
                params![format!("operation-{id}"), id, kind],
            )
            .unwrap();
        store.connection.execute("INSERT INTO messages(id,conversation_id,turn_id,sequence,role,text) VALUES(?1,?2,?3,?4,'assistant',?5)",params![format!("message-{id}"),conversation,id,index,text]).unwrap();
        id
    }
    #[test]
    fn full_history_is_ordered_and_superseded_predecessor_is_excluded() {
        let (_dir, store, conversation) = fixture();
        for i in 1..=125 {
            turn(
                &store,
                &conversation,
                i,
                "persona_reply",
                &format!("Message {i}"),
            );
        }
        store
            .connection
            .execute(
                "UPDATE turns SET replaces_turn_id=?1 WHERE id=?2",
                params![
                    format!("turn-{conversation}-1"),
                    format!("turn-{conversation}-125")
                ],
            )
            .unwrap();
        let yaml = render(&store, &conversation, false, false).unwrap();
        let result: Value = serde_yaml_ng::from_str(&yaml).unwrap();
        assert_eq!(result["messages"].as_array().unwrap().len(), 124);
        assert_eq!(result["messages"][0]["sequence"], 2);
        assert_eq!(result["messages"][123]["sequence"], 125);
        assert!(result.get("coach").is_none());
        assert!(result.get("backend").is_none());
        assert_eq!(result["schema"], "skellyspeak.conversation");
        assert_eq!(result["version"], 1);
    }
    #[test]
    fn optional_sections_are_scoped_and_never_include_private_backend_payloads() {
        let (_dir, store, conversation) = fixture();
        let turn_id = turn(
            &store,
            &conversation,
            1,
            "persona_opening",
            "Partner opening",
        );
        turn(
            &store,
            &conversation,
            2,
            "coach_reply",
            "PRIVATE_COACH_THREAD",
        );
        store.connection.execute("INSERT INTO attempts(id,operation_id,state,requested_model,error,provider_id,input_tokens,output_tokens) VALUES('attempt',?1,'failed','fixture-model','SECRET_ERROR','SECRET_PROVIDER_RESPONSE',10,2)",[format!("operation-{turn_id}")]).unwrap();
        let observed = json!({"meaning_recovered":"partial","items":[{"construct":"question","quote":"Partner opening","outcome":"partial","error":{"op":"missing","category":"AUX","source":"unknown","blocks_meaning":true,"target_hypothesis":"SECRET_HYPOTHESIS","hint":"A hint","elicitation":"Try again","metalinguistic":"A rule"},"rationale":"SECRET_RATIONALE"}]});
        let decision = json!({"exposedMove":"hint","repairStatus":null,"shown":{"construct":"question","quote":"Partner opening","move":"hint","text":"VISIBLE_COACH_HINT"},"retryInvited":true,"fixed":null,"alsoNoticed":[],"keptGoing":false});
        store
            .connection
            .execute(
                "UPDATE turns SET context=json_set(context,'$.coachDecision',json(?2)) WHERE id=?1",
                params![turn_id, decision.to_string()],
            )
            .unwrap();
        store.connection.execute("UPDATE turns SET context=json_set(context,'$.coachObservation',json(?2),'$.candidateConstructs',json(?3)) WHERE id=?1",params![turn_id,observed.to_string(),json!([{"id":"question"}]).to_string()]).unwrap();
        // A second conversation can contain private data; none may cross scope.
        store.connection.execute("INSERT INTO conversations(id,contact_id,language_id,title,archived,revision,last_used) SELECT 'other',contact_id,language_id,'UNRELATED_TITLE',0,1,0 FROM conversations WHERE id=?1",[&conversation]).unwrap();
        turn(&store, "other", 1, "persona_reply", "UNRELATED_MESSAGE");
        for coach in [false, true] {
            for backend in [false, true] {
                let yaml = render(&store, &conversation, coach, backend).unwrap();
                assert_eq!(yaml.contains("PRIVATE_COACH_THREAD"), coach);
                assert_eq!(yaml.contains("VISIBLE_COACH_HINT"), coach);
                assert_eq!(yaml.contains("input_tokens: 10"), backend);
                assert_eq!(yaml.contains("fixture-hash"), backend);
                for secret in [
                    "SECRET_HYPOTHESIS",
                    "SECRET_RATIONALE",
                    "SECRET_CREDENTIAL",
                    "SECRET_PROMPT",
                    "SECRET_ENDPOINT",
                    "SECRET_ERROR",
                    "SECRET_PROVIDER_RESPONSE",
                    "UNRELATED_TITLE",
                    "UNRELATED_MESSAGE",
                ] {
                    assert!(!yaml.contains(secret), "Export leaked {secret}");
                }
            }
        }
        assert_eq!(
            render(&store, "missing", true, true).unwrap_err().code,
            ErrorCode::NotFound
        );
    }
    #[test]
    fn save_is_exact_and_never_overwrites_an_existing_file() {
        let (dir, store, conversation) = fixture();
        let yaml = render(&store, &conversation, false, false).unwrap();
        let path = dir.path().join("export.yaml");
        write_new(&path, &yaml).unwrap();
        assert_eq!(std::fs::read_to_string(&path).unwrap(), yaml);
        assert!(write_new(&path, "replacement").is_err());
        assert_eq!(std::fs::read_to_string(path).unwrap(), yaml);
    }
}
