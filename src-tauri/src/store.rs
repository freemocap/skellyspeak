use crate::{languages, model::*};
use rusqlite::{Connection, OptionalExtension, params};
use std::path::Path;
use uuid::Uuid;

pub(crate) fn prepare_private_directory(path: &Path) -> std::io::Result<()> {
    let mut builder = std::fs::DirBuilder::new();
    builder.recursive(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::DirBuilderExt;
        builder.mode(0o700);
    }
    builder.create(path)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if std::fs::symlink_metadata(path)?.file_type().is_symlink() {
            return Err(std::io::Error::other(
                "Application data directory cannot be a symbolic link.",
            ));
        }
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o700))?;
    }
    Ok(())
}

/// Current development schema. Other versions require an explicit workspace reset.
pub(crate) const SCHEMA_VERSION: i32 = 13;
const GENERATION_SCHEMA: &str = include_str!("generation_schema.sql");

/// The workspace database, inside the application data directory.
pub(crate) const WORKSPACE_FILE: &str = "skellyspeak.sqlite3";

/// A stable lock inode. Reset must retain this guard and leave the lock file in
/// place, including after closing SQLite, so a second process cannot enter.
#[derive(Clone)]
pub(crate) struct WorkspaceOwnership {
    _file: std::sync::Arc<std::fs::File>,
}

pub(crate) const WORKSPACE_LOCK: &str = "skellyspeak.lock";

impl WorkspaceOwnership {
    pub(crate) fn acquire(path: &Path) -> Result<Self> {
        let lock_path = path.with_extension("lock");
        if std::fs::symlink_metadata(&lock_path)
            .is_ok_and(|m| !m.is_file() || m.file_type().is_symlink())
        {
            return Err(AppError::new(
                ErrorCode::Storage,
                "Workspace lock is not a regular file.",
            ));
        }
        let mut options = std::fs::OpenOptions::new();
        options.read(true).write(true).create(true).truncate(false);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let lock = options
            .open(lock_path)
            .map_err(|e| AppError::new(ErrorCode::Storage, e.to_string()))?;
        lock.try_lock().map_err(|_| AppError::new(
            ErrorCode::Conflict,
            "The workspace is already open or cannot be locked. Close other instances and restart the app.",
        ))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            lock.set_permissions(std::fs::Permissions::from_mode(0o600))
                .map_err(|e| AppError::new(ErrorCode::Storage, e.to_string()))?;
        }
        Ok(Self {
            _file: std::sync::Arc::new(lock),
        })
    }
}

pub struct Store {
    pub(crate) connection: Connection,
    pub(crate) session_id: String,
    pub(crate) credential_writes: std::collections::HashSet<String>,
    /// Where credential identifiers are recorded outside the database, so a
    /// factory reset can remove secrets even when the workspace will not open.
    pub(crate) credential_index: std::path::PathBuf,
    pub(crate) speech_cache: crate::speech::Cache,
    ownership: WorkspaceOwnership,
}

fn id() -> String {
    Uuid::new_v4().to_string()
}
fn missing() -> AppError {
    AppError::new(
        ErrorCode::NotFound,
        "This item no longer exists. Refresh the view.",
    )
}
/// A bounded, nonempty, single-line label. Persona fields have their own limits
/// in `crate::persona`.
fn short_text(value: &str, label: &str, max: usize) -> Result<()> {
    if value.trim().is_empty() || value.chars().count() > max || value.contains('\0') {
        return Err(AppError::new(
            ErrorCode::Validation,
            format!("{label} must be nonempty and at most {max} characters."),
        ));
    }
    Ok(())
}
fn check_revision(actual: i32, expected: i32) -> Result<()> {
    if actual != expected {
        return Err(AppError::new(
            ErrorCode::Conflict,
            "This item changed. Review the saved value before applying your edit again.",
        ));
    }
    Ok(())
}

fn validate_database(connection: &Connection) -> Result<()> {
    let application_id: i32 =
        connection.pragma_query_value(None, "application_id", |r| r.get(0))?;
    if application_id != 1397443659 {
        return Err(AppError::new(
            ErrorCode::Storage,
            "Unexpected database identity.",
        ));
    }
    let integrity: String = connection.query_row("PRAGMA quick_check", [], |r| r.get(0))?;
    if integrity != "ok" {
        return Err(AppError::new(ErrorCode::Storage, integrity));
    }
    if connection.prepare("PRAGMA foreign_key_check")?.exists([])? {
        return Err(AppError::new(
            ErrorCode::Storage,
            "Invalid database ownership references.",
        ));
    }
    Ok(())
}

/// Check current DDL, including revision constraints, before startup writes.
fn validate_current_schema(connection: &Connection) -> Result<()> {
    let reference = Connection::open_in_memory()?;
    reference.execute_batch(include_str!("schema.sql"))?;
    reference.execute_batch(GENERATION_SCHEMA)?;
    let mut statement = reference.prepare("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'")?;
    for row in statement.query_map([], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, String>(2)?,
        ))
    })? {
        let (kind, name, sql) = row?;
        let actual: Option<(String, String)> = connection
            .query_row(
                "SELECT type,sql FROM sqlite_master WHERE name=?1",
                [&name],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()?;
        if actual != Some((kind, sql)) {
            return Err(AppError::new(
                ErrorCode::Storage,
                format!("Unexpected current schema object: {name}. No data was changed."),
            ));
        }
    }
    Ok(())
}

impl Store {
    pub(crate) fn ownership(&self) -> WorkspaceOwnership {
        self.ownership.clone()
    }

    pub fn open(path: &Path) -> Result<Self> {
        let ownership = WorkspaceOwnership::acquire(path)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
            let private_file = || -> std::io::Result<()> {
                let file = std::fs::OpenOptions::new()
                    .read(true)
                    .write(true)
                    .create(true)
                    .truncate(false)
                    .mode(0o600)
                    .open(path)?;
                file.set_permissions(std::fs::Permissions::from_mode(0o600))
            };
            private_file().map_err(|_| {
                AppError::new(
                    ErrorCode::Storage,
                    "Could not restrict database access to this user.",
                )
            })?;
        }
        let mut connection = Connection::open(path)?;
        connection.pragma_update(None, "foreign_keys", true)?;
        connection.busy_timeout(std::time::Duration::from_secs(3))?;
        let version: i32 = connection.pragma_query_value(None, "user_version", |r| r.get(0))?;
        if version == 0 {
            let count: i32 = connection.query_row(
                "SELECT count(*) FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'",
                [],
                |r| r.get(0),
            )?;
            if count != 0 {
                return Err(AppError::new(
                    ErrorCode::Storage,
                    "Unrecognized database. No data was changed. Use Factory Reset to start a new workspace.",
                ));
            }
            let tx = connection.transaction()?;
            tx.execute_batch(include_str!("schema.sql"))?;
            tx.execute_batch(GENERATION_SCHEMA)?;
            tx.pragma_update(None, "user_version", SCHEMA_VERSION)?;
            let preferences = Preferences {
                explanation_language: "en".into(),
                text_size: crate::model::TEXT_SIZE_DEFAULT,
                text_spacing: 0,
                high_contrast: false,
                onboarding: OnboardingStatus::NotStarted,
            };
            tx.execute(
                "INSERT INTO learner VALUES(?1,1,'Learner',1,?2)",
                params![id(), serde_json::to_string(&preferences)?],
            )?;
            tx.commit()?;
        }
        // Development data may be reset explicitly; startup never silently wipes it.
        let version: i32 = connection.pragma_query_value(None, "user_version", |r| r.get(0))?;
        if version != SCHEMA_VERSION {
            return Err(AppError::new(
                ErrorCode::Storage,
                format!(
                    "This workspace uses schema version {version}, and this build supports only version {SCHEMA_VERSION}. No data was changed. Use Factory Reset to start a new workspace."
                ),
            ));
        }
        validate_database(&connection)?;
        validate_current_schema(&connection)?;
        crate::progression::initialize(&connection)?;
        crate::reward_settings::initialize(&connection)?;
        let store = Self {
            connection,
            session_id: id(),
            speech_cache: crate::speech::Cache::default(),
            credential_writes: std::collections::HashSet::new(),
            credential_index: path.with_file_name("credentials.index"),
            ownership,
        };
        store.snapshot()?;
        store.reconcile_execution()?;
        crate::generation_receipts::recover(&store.connection)?;
        store.connection.execute("DELETE FROM receipts", [])?;
        Ok(store)
    }

    pub fn prepare_chat(&mut self) -> Result<()> {
        let snapshot = self.snapshot()?;
        if snapshot.conversations.iter().any(|c| {
            !c.archived
                && snapshot
                    .contacts
                    .iter()
                    .any(|r| r.id == c.contact_id && !r.archived)
        }) {
            return Ok(());
        }
        let action = match snapshot.contacts.iter().find(|r| !r.archived) {
            Some(contact) => Action::CreateConversation {
                contact_id: contact.id.clone(),
                title: "New conversation".into(),
            },
            None => Action::StartChat {
                language_id: "es".into(),
            },
        };
        self.execute(Command {
            session_id: self.session_id.clone(),
            action_id: id(),
            action,
        })?;
        Ok(())
    }

    pub fn snapshot(&self) -> Result<Snapshot> {
        read_snapshot(&self.connection, &self.session_id)
    }

    pub fn execute(&mut self, command: Command) -> Result<Receipt> {
        if command.session_id != self.session_id {
            return Err(AppError::new(
                ErrorCode::SessionExpired,
                "The application session changed. Refresh before continuing.",
            ));
        }
        Uuid::parse_str(&command.action_id)
            .map_err(|_| AppError::new(ErrorCode::Validation, "Invalid action identity."))?;
        let request = serde_json::to_string(&command.action)?;
        let tx = self.connection.transaction()?;
        let previous: Option<(String, String)> = tx
            .query_row(
                "SELECT request,receipt FROM receipts WHERE action_id=?1",
                [&command.action_id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()?;
        if let Some((stored_request, receipt)) = previous {
            if stored_request != request {
                return Err(AppError::new(
                    ErrorCode::Conflict,
                    "An action ID cannot be reused for another action.",
                ));
            }
            return Ok(serde_json::from_str(&receipt)?);
        }
        let snapshot = read_snapshot(&tx, &self.session_id)?;
        let revision = snapshot
            .revision
            .checked_add(1)
            .ok_or_else(|| AppError::new(ErrorCode::Storage, "Revision capacity exceeded."))?;
        let mut persona_scope: Option<String> = None;
        let mut conversation_scope: Option<String> = None;
        let entity_id = match command.action {
            Action::ReviseTurn {
                conversation_id,
                turn_id,
                text,
                input,
                expected_revision,
            } => {
                let result = crate::revision::accept(
                    &tx,
                    &snapshot,
                    &conversation_id,
                    &turn_id,
                    &text,
                    input,
                    expected_revision,
                )?;
                conversation_scope = Some(conversation_id);
                result
            }
            Action::AskCoach {
                conversation_id,
                text,
                expected_revision,
            } => {
                let turn_id = crate::execution::accept_coach(
                    &tx,
                    &snapshot,
                    &conversation_id,
                    &text,
                    expected_revision,
                )?;
                conversation_scope = Some(conversation_id);
                turn_id
            }
            Action::SendMessage {
                input,
                conversation_id,
                text,
                expected_revision,
            } => {
                let turn_id = crate::execution::accept_send(
                    &tx,
                    &snapshot,
                    &conversation_id,
                    &text,
                    expected_revision,
                )?;
                if !matches!(input.modality.as_str(), "text" | "speech_transcript") {
                    return Err(AppError::new(
                        ErrorCode::Validation,
                        "Invalid input modality.",
                    ));
                }
                tx.execute(
                    "UPDATE turns SET context=json_set(context,'$.input',json(?2)) WHERE id=?1",
                    params![turn_id, serde_json::to_string(&input)?],
                )?;
                conversation_scope = Some(conversation_id);
                turn_id
            }
            Action::RequestMessageSpeech { message_id } => {
                let cached_attempt: Option<String> = tx.query_row(
                    "SELECT a.id FROM attempts a JOIN operations o ON o.id=a.operation_id JOIN messages m ON m.turn_id=o.turn_id WHERE m.id=?1 AND o.kind='persona_speech' AND o.state='succeeded' AND a.state='succeeded' ORDER BY a.rowid DESC LIMIT 1",
                    [&message_id], |r| r.get(0),
                ).optional()?;
                let resident = cached_attempt
                    .as_ref()
                    .is_some_and(|attempt| self.speech_cache.get(attempt).is_some());
                let operation = crate::execution::request_speech(&tx, &message_id, resident)?;
                conversation_scope = Some(tx.query_row(
                    "SELECT conversation_id FROM messages WHERE id=?1",
                    [&message_id],
                    |r| r.get(0),
                )?);
                operation
            }
            Action::CancelMessageSpeech { operation_id } => {
                let operation = crate::execution::cancel_speech(&tx, &operation_id)?;
                conversation_scope = Some(tx.query_row("SELECT t.conversation_id FROM operations o JOIN turns t ON t.id=o.turn_id WHERE o.id=?1", [&operation], |r|r.get(0))?);
                operation
            }
            Action::RetryGloss { operation_id } => {
                conversation_scope = Some(crate::execution::retry_gloss(&tx, &operation_id)?);
                operation_id
            }
            Action::ControlTurn { turn_id, control } => {
                conversation_scope = Some(crate::execution::control_turn(&tx, &turn_id, control)?);
                turn_id
            }
            Action::SetPaused { paused } => {
                tx.execute("UPDATE ai_config SET paused=?1 WHERE singleton=1", [paused])?;
                tx.execute("UPDATE operations SET permit=0 WHERE state='ready'", [])?;
                "execution".into()
            }
            Action::RecoverAiAccess {
                hold_id,
                expected_generation,
            } => {
                crate::holds::recover(&tx, &hold_id, &expected_generation)?;
                hold_id
            }
            Action::StartChat { language_id } => {
                let details = crate::persona::starter(&language_id)?;
                let (persona_id, contact_id) =
                    create_persona(&tx, &snapshot.learner.id, &language_id, details)?;
                let settings = languages::defaults(
                    &language_id,
                    &snapshot.learner.preferences.explanation_language,
                )?;
                let conversation_id = create_conversation(
                    &tx,
                    &contact_id,
                    &language_id,
                    "New conversation",
                    &settings,
                )?;
                persona_scope = Some(persona_id);
                conversation_scope = Some(conversation_id.clone());
                conversation_id
            }
            Action::CreateContact {
                language_id,
                details,
            } => {
                let (persona_id, contact_id) =
                    create_persona(&tx, &snapshot.learner.id, &language_id, details)?;
                let settings = languages::defaults(
                    &language_id,
                    &snapshot.learner.preferences.explanation_language,
                )?;
                let conversation_id = create_conversation(
                    &tx,
                    &contact_id,
                    &language_id,
                    "New conversation",
                    &settings,
                )?;
                persona_scope = Some(persona_id);
                conversation_scope = Some(conversation_id.clone());
                conversation_id
            }
            Action::UpdatePersona {
                persona_id,
                expected_revision,
                details,
            } => {
                let persona = snapshot
                    .personas
                    .iter()
                    .find(|p| p.id == persona_id)
                    .ok_or_else(missing)?;
                check_revision(persona.revision, expected_revision)?;
                crate::persona::validate(&details, &persona.language_id)?;
                tx.execute(
                    "UPDATE personas SET details=?1,revision=revision+1 WHERE id=?2",
                    params![serde_json::to_string(&details)?, persona_id],
                )?;
                persona_scope = Some(persona_id.clone());
                persona_id
            }
            Action::SetContactArchived {
                contact_id,
                expected_revision,
                archived,
            } => {
                let contact = snapshot
                    .contacts
                    .iter()
                    .find(|r| r.id == contact_id)
                    .ok_or_else(missing)?;
                check_revision(contact.revision, expected_revision)?;
                tx.execute(
                    "UPDATE contacts SET archived=?1,revision=revision+1 WHERE id=?2",
                    params![archived, contact_id],
                )?;
                persona_scope = Some(contact.persona_id.clone());
                contact_id
            }
            Action::DeleteContact {
                contact_id,
                expected_revision,
            } => {
                let contact = snapshot
                    .contacts
                    .iter()
                    .find(|c| c.id == contact_id)
                    .ok_or_else(missing)?;
                check_revision(contact.revision, expected_revision)?;
                // One persona per contact: removing the contact removes its
                // persona, and the cascade takes the conversations with it.
                tx.execute("DELETE FROM personas WHERE id=?1", [&contact.persona_id])?;
                contact_id
            }
            Action::CreateConversation { contact_id, title } => {
                short_text(&title, "Conversation title", 100)?;
                let contact = snapshot
                    .contacts
                    .iter()
                    .find(|r| r.id == contact_id)
                    .ok_or_else(missing)?;
                if contact.archived {
                    return Err(AppError::new(
                        ErrorCode::Validation,
                        "Restore this persona before creating a conversation.",
                    ));
                }
                let persona = snapshot
                    .personas
                    .iter()
                    .find(|p| p.id == contact.persona_id)
                    .ok_or_else(missing)?;
                let recent = snapshot
                    .conversations
                    .iter()
                    .filter(|c| c.contact_id == contact_id)
                    .max_by(|a, b| a.last_used.cmp(&b.last_used).then(a.id.cmp(&b.id)));
                let settings = match recent {
                    Some(c) => c.settings.clone(),
                    None => languages::defaults(
                        &persona.language_id,
                        &snapshot.learner.preferences.explanation_language,
                    )?,
                };
                let conversation_id = create_conversation(
                    &tx,
                    &contact_id,
                    &persona.language_id,
                    title.trim(),
                    &settings,
                )?;
                persona_scope = Some(persona.id.clone());
                conversation_scope = Some(conversation_id.clone());
                conversation_id
            }
            Action::OpenConversation { conversation_id } => {
                let conversation = snapshot
                    .conversations
                    .iter()
                    .find(|c| c.id == conversation_id)
                    .ok_or_else(missing)?;
                tx.execute(
                    "UPDATE conversations SET last_used=MAX(CAST((julianday('now')-2440587.5)*86400000 AS INTEGER),COALESCE((SELECT MAX(last_used) FROM conversations),0)+1) WHERE id=?1",
                    params![conversation_id],
                )?;
                conversation_scope = Some(conversation.id.clone());
                conversation_id
            }
            Action::UpdateConversation {
                conversation_id,
                expected_revision,
                title,
                archived,
            } => {
                short_text(&title, "Conversation title", 100)?;
                let conversation = snapshot
                    .conversations
                    .iter()
                    .find(|c| c.id == conversation_id)
                    .ok_or_else(missing)?;
                check_revision(conversation.revision, expected_revision)?;
                tx.execute(
                    "UPDATE conversations SET title=?1,archived=?2,revision=revision+1 WHERE id=?3",
                    params![title.trim(), archived, conversation_id],
                )?;
                conversation_scope = Some(conversation_id.clone());
                conversation_id
            }
            Action::UpdateSettings {
                conversation_id,
                expected_revision,
                settings,
            } => {
                let conversation = snapshot
                    .conversations
                    .iter()
                    .find(|c| c.id == conversation_id)
                    .ok_or_else(missing)?;
                check_revision(conversation.settings_revision, expected_revision)?;
                languages::validate_settings(&conversation.language_id, &settings)?;
                tx.execute("UPDATE conversation_settings SET settings=?1,revision=revision+1 WHERE conversation_id=?2", params![serde_json::to_string(&settings)?, conversation_id])?;
                tx.execute(
                    "UPDATE conversations SET revision=revision+1 WHERE id=?1",
                    [&conversation_id],
                )?;
                conversation_scope = Some(conversation_id.clone());
                conversation_id
            }
            Action::DeleteConversation {
                conversation_id,
                expected_revision,
            } => {
                let conversation = snapshot
                    .conversations
                    .iter()
                    .find(|c| c.id == conversation_id)
                    .ok_or_else(missing)?;
                check_revision(conversation.revision, expected_revision)?;
                tx.execute("DELETE FROM conversations WHERE id=?1", [&conversation_id])?;
                conversation_id
            }
            Action::UpdateLearner {
                expected_revision,
                name,
                preferences,
            } => {
                check_revision(snapshot.learner.revision, expected_revision)?;
                short_text(&name, "Learner name", 80)?;
                languages::language(&preferences.explanation_language)?;
                if !(crate::model::TEXT_SIZE_MIN..=crate::model::TEXT_SIZE_MAX)
                    .contains(&preferences.text_size)
                    || preferences.text_spacing > 12
                {
                    return Err(AppError::new(
                        ErrorCode::Validation,
                        "Reading size or spacing is outside the supported range.",
                    ));
                }
                tx.execute(
                    "UPDATE learner SET name=?1,preferences=?2,revision=revision+1 WHERE id=?3",
                    params![
                        name.trim(),
                        serde_json::to_string(&preferences)?,
                        snapshot.learner.id
                    ],
                )?;
                snapshot.learner.id
            }
        };
        tx.execute(
            "UPDATE metadata SET revision=?1 WHERE singleton=1",
            [revision],
        )?;
        let receipt = Receipt {
            action_id: command.action_id,
            entity_id,
            revision,
        };
        tx.execute(
            "INSERT INTO receipts VALUES(?1,?2,?3,?4,?5)",
            params![
                receipt.action_id,
                request,
                serde_json::to_string(&receipt)?,
                persona_scope,
                conversation_scope
            ],
        )?;
        tx.commit()?;
        Ok(receipt)
    }
}

fn decode<T: serde::de::DeserializeOwned>(
    row: &rusqlite::Row<'_>,
    index: usize,
) -> rusqlite::Result<T> {
    let raw: String = row.get(index)?;
    serde_json::from_str(&raw).map_err(|e| {
        rusqlite::Error::FromSqlConversionFailure(index, rusqlite::types::Type::Text, Box::new(e))
    })
}
fn read_snapshot(connection: &Connection, session_id: &str) -> Result<Snapshot> {
    let learner = connection.query_row(
        "SELECT id,name,revision,preferences FROM learner WHERE singleton=1",
        [],
        |r| {
            Ok(Learner {
                id: r.get(0)?,
                name: r.get(1)?,
                revision: r.get(2)?,
                preferences: decode(r, 3)?,
            })
        },
    )?;
    let language_profiles = connection
        .prepare("SELECT id,learner_id,language_id FROM language_profiles ORDER BY language_id")?
        .query_map([], |r| {
            Ok(LanguageProfile {
                id: r.get(0)?,
                learner_id: r.get(1)?,
                language_id: r.get(2)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let personas: Vec<Persona> = connection
        .prepare("SELECT id,learner_id,language_id,revision,details FROM personas ORDER BY rowid")?
        .query_map([], |r| {
            Ok(Persona {
                id: r.get(0)?,
                learner_id: r.get(1)?,
                language_id: r.get(2)?,
                revision: r.get(3)?,
                details: decode(r, 4)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let contacts = connection
        .prepare("SELECT id,learner_id,persona_id,archived,revision FROM contacts ORDER BY rowid")?
        .query_map([], |r| {
            Ok(Contact {
                id: r.get(0)?,
                learner_id: r.get(1)?,
                persona_id: r.get(2)?,
                archived: r.get(3)?,
                revision: r.get(4)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let conversations: Vec<Conversation> = connection.prepare("SELECT c.id,c.contact_id,c.language_id,c.title,c.archived,c.revision,c.created_at,MAX(c.last_used,CAST((julianday(c.created_at)-2440587.5)*86400000 AS INTEGER),COALESCE((SELECT CAST((julianday(MAX(m.created_at))-2440587.5)*86400000 AS INTEGER) FROM messages m WHERE m.conversation_id=c.id),0)) AS activity_ms,s.revision,s.settings FROM conversations c JOIN conversation_settings s ON s.conversation_id=c.id ORDER BY activity_ms DESC,c.id DESC")?.query_map([], |r| Ok(Conversation { id:r.get(0)?,contact_id:r.get(1)?,language_id:r.get(2)?,title:r.get(3)?,archived:r.get(4)?,revision:r.get(5)?,created_at:r.get(6)?,last_used:r.get(7)?,settings_revision:r.get(8)?,settings:decode(r,9)? }))?.collect::<rusqlite::Result<Vec<_>>>()?;
    let total: i64 =
        connection.query_row("SELECT count(*) FROM conversations", [], |r| r.get(0))?;
    if total != conversations.len() as i64 {
        return Err(AppError::new(
            ErrorCode::Storage,
            "Conversation settings are missing.",
        ));
    }
    for persona in &personas {
        crate::persona::validate(&persona.details, &persona.language_id)?;
    }
    for conversation in &conversations {
        languages::validate_settings(&conversation.language_id, &conversation.settings)?;
    }
    Ok(Snapshot {
        session_id: session_id.into(),
        revision: connection.query_row(
            "SELECT revision FROM metadata WHERE singleton=1",
            [],
            |r| r.get(0),
        )?,
        learner,
        languages: languages::registry(),
        language_profiles,
        personas,
        contacts,
        conversations,
    })
}

/// The one place a persona and its contact are created, from the starter or from
/// a generated result. The language is validated here.
fn create_persona(
    db: &Connection,
    learner: &str,
    language_id: &str,
    details: PersonaDetails,
) -> Result<(String, String)> {
    crate::persona::validate(&details, language_id)?;
    let persona_id = id();
    let contact_id = id();
    db.execute("INSERT INTO language_profiles SELECT ?1,?2,?3 WHERE NOT EXISTS(SELECT 1 FROM language_profiles WHERE learner_id=?2 AND language_id=?3)", params![id(), learner, language_id])?;
    db.execute(
        "INSERT INTO personas VALUES(?1,?2,?3,1,?4)",
        params![
            persona_id,
            learner,
            language_id,
            serde_json::to_string(&details)?
        ],
    )?;
    db.execute(
        "INSERT INTO contacts VALUES(?1,?2,?3,0,1)",
        params![contact_id, learner, persona_id],
    )?;
    Ok((persona_id, contact_id))
}

/// The one place a conversation is created for a contact.
fn create_conversation(
    db: &Connection,
    contact_id: &str,
    language_id: &str,
    title: &str,
    settings: &PracticeSettings,
) -> Result<String> {
    let conversation_id = id();
    db.execute("INSERT INTO conversations(id,contact_id,language_id,title,archived,revision,last_used) VALUES(?1,?2,?3,?4,0,1,MAX(CAST((julianday('now')-2440587.5)*86400000 AS INTEGER),COALESCE((SELECT MAX(last_used) FROM conversations),0)+1))", params![conversation_id, contact_id, language_id, title])?;
    db.execute(
        "INSERT INTO conversation_settings VALUES(?1,1,?2)",
        params![conversation_id, serde_json::to_string(settings)?],
    )?;
    Ok(conversation_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn command(store: &Store, action: Action) -> Command {
        Command {
            session_id: store.session_id.clone(),
            action_id: id(),
            action,
        }
    }
    fn apply(store: &mut Store, action: Action) -> Receipt {
        store.execute(command(store, action)).unwrap()
    }
    fn contact(store: &mut Store) -> Contact {
        apply(
            store,
            Action::CreateContact {
                language_id: "es".into(),
                details: crate::persona::starter("es").unwrap(),
            },
        );
        store.snapshot().unwrap().contacts.last().unwrap().clone()
    }
    fn conversation(store: &mut Store, contact: &Contact, title: &str) -> Conversation {
        let receipt = apply(
            store,
            Action::CreateConversation {
                contact_id: contact.id.clone(),
                title: title.into(),
            },
        );
        store
            .snapshot()
            .unwrap()
            .conversations
            .into_iter()
            .find(|c| c.id == receipt.entity_id)
            .unwrap()
    }
    #[cfg(unix)]
    #[test]
    fn application_data_and_database_are_owner_only() {
        use std::os::unix::fs::PermissionsExt;
        let root = tempfile::tempdir().unwrap();
        let directory = root.path().join("app-data");
        std::fs::create_dir(&directory).unwrap();
        std::fs::set_permissions(&directory, std::fs::Permissions::from_mode(0o755)).unwrap();
        prepare_private_directory(&directory).unwrap();
        let path = directory.join("skellyspeak.sqlite3");
        std::fs::write(&path, []).unwrap();
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o644)).unwrap();
        let _store = Store::open(&path).unwrap();
        assert_eq!(
            std::fs::metadata(&directory).unwrap().permissions().mode() & 0o777,
            0o700
        );
        for file in [&path, &path.with_extension("lock")] {
            assert_eq!(
                std::fs::metadata(file).unwrap().permissions().mode() & 0o777,
                0o600
            );
        }
    }

    #[test]
    fn voice_defaults_are_persistent_and_opt_out_survives_restart() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("skellyspeak.sqlite3");
        let mut store = Store::open(&path).unwrap();
        store.prepare_chat().unwrap();
        let conversation = store.snapshot().unwrap().conversations.remove(0);
        assert!(conversation.settings.auto_send && conversation.settings.read_aloud);
        let mut settings = conversation.settings;
        settings.auto_send = false;
        settings.read_aloud = false;
        apply(
            &mut store,
            Action::UpdateSettings {
                conversation_id: conversation.id,
                expected_revision: conversation.settings_revision,
                settings,
            },
        );
        drop(store);
        let store = Store::open(&path).unwrap();
        let settings = &store.snapshot().unwrap().conversations[0].settings;
        assert!(!settings.auto_send && !settings.read_aloud);
        assert_eq!(settings.speech_voice, "alloy");
    }

    #[test]
    fn startup_opens_chat_without_setup_and_does_not_duplicate_it() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("skellyspeak.sqlite3");
        let mut store = Store::open(&path).unwrap();
        store.prepare_chat().unwrap();
        let snapshot = store.snapshot().unwrap();
        assert_eq!(snapshot.personas.len(), 1);
        assert_eq!(snapshot.conversations.len(), 1);
        assert_eq!(snapshot.conversations[0].language_id, "es");
        let conversation = snapshot.conversations[0].id.clone();
        store.prepare_chat().unwrap();
        drop(store);
        let mut store = Store::open(&path).unwrap();
        store.prepare_chat().unwrap();
        let snapshot = store.snapshot().unwrap();
        assert_eq!(snapshot.conversations.len(), 1);
        assert_eq!(snapshot.conversations[0].id, conversation);
    }
    #[test]
    fn one_click_persona_and_chat_creation_is_atomic_and_replay_safe() {
        let directory = tempfile::tempdir().unwrap();
        let mut store = Store::open(&directory.path().join("skellyspeak.sqlite3")).unwrap();
        let command = Command {
            session_id: store.session_id.clone(),
            action_id: id(),
            action: Action::StartChat {
                language_id: "fr".into(),
            },
        };
        let receipt = store.execute(command.clone()).unwrap();
        assert_eq!(store.execute(command).unwrap().entity_id, receipt.entity_id);
        let snapshot = store.snapshot().unwrap();
        assert_eq!(snapshot.personas.len(), 1);
        assert_eq!(snapshot.conversations.len(), 1);
        assert_eq!(snapshot.conversations[0].id, receipt.entity_id);
        assert_eq!(snapshot.conversations[0].language_id, "fr");
        let invalid = Command {
            session_id: store.session_id.clone(),
            action_id: id(),
            action: Action::StartChat {
                language_id: "invalid".into(),
            },
        };
        assert!(store.execute(invalid).is_err());
        assert_eq!(store.snapshot().unwrap().personas.len(), 1);
    }
    #[test]
    fn a_generated_contact_arrives_with_its_own_conversation_or_writes_nothing() {
        let directory = tempfile::tempdir().unwrap();
        let mut store = Store::open(&directory.path().join("skellyspeak.sqlite3")).unwrap();
        let generated = PersonaDetails {
            name: "Generated".into(),
            ..crate::persona::starter("es").unwrap()
        };
        let receipt = apply(
            &mut store,
            Action::CreateContact {
                language_id: "es".into(),
                details: generated.clone(),
            },
        );
        let snapshot = store.snapshot().unwrap();
        assert_eq!(snapshot.personas.len(), 1);
        assert_eq!(snapshot.personas[0].details.name, "Generated");
        assert_eq!(snapshot.conversations.len(), 1);
        assert_eq!(snapshot.conversations[0].id, receipt.entity_id);
        for rejected in [
            PersonaDetails {
                age: Some(12),
                ..generated.clone()
            },
            PersonaDetails {
                vibe: vec!["not an emoji".into()],
                ..generated.clone()
            },
            PersonaDetails {
                name: "  ".into(),
                ..generated
            },
        ] {
            let before = store.snapshot().unwrap().revision;
            let refused = command(
                &store,
                Action::CreateContact {
                    language_id: "es".into(),
                    details: rejected,
                },
            );
            assert_eq!(
                store.execute(refused).unwrap_err().code,
                ErrorCode::Validation
            );
            let after = store.snapshot().unwrap();
            assert_eq!(after.revision, before);
            assert_eq!(after.personas.len(), 1);
            assert_eq!(after.conversations.len(), 1);
        }
    }
    #[test]
    fn settings_are_independent_copies_of_last_opened_conversation_and_survive_restart() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("skellyspeak.sqlite3");
        let mut store = Store::open(&path).unwrap();
        let contact = contact(&mut store);
        let first = conversation(&mut store, &contact, "Weekend plans");
        let mut settings = first.settings.clone();
        settings.difficulty = Difficulty::Advanced;
        settings.translation = false;
        apply(
            &mut store,
            Action::UpdateSettings {
                conversation_id: first.id.clone(),
                expected_revision: 1,
                settings: settings.clone(),
            },
        );
        let second = conversation(&mut store, &contact, "Kitchen stories");
        assert_eq!(second.settings, settings);
        settings.difficulty = Difficulty::Beginner;
        apply(
            &mut store,
            Action::UpdateSettings {
                conversation_id: second.id.clone(),
                expected_revision: 1,
                settings,
            },
        );
        apply(
            &mut store,
            Action::OpenConversation {
                conversation_id: first.id.clone(),
            },
        );
        let third = conversation(&mut store, &contact, "Train journey");
        assert_eq!(third.settings.difficulty, Difficulty::Advanced);
        drop(store);
        let snapshot = Store::open(&path).unwrap().snapshot().unwrap();
        // The contact's first conversation plus the three created here.
        assert_eq!(snapshot.conversations.len(), 4);
        assert_eq!(
            snapshot
                .conversations
                .iter()
                .find(|c| c.id == second.id)
                .unwrap()
                .settings
                .difficulty,
            Difficulty::Beginner
        );
        assert_eq!(snapshot.language_profiles.len(), 1);
    }
    #[test]
    fn duplicate_commands_are_idempotent_and_reusing_identity_with_other_payload_fails() {
        let directory = tempfile::tempdir().unwrap();
        let mut store = Store::open(&directory.path().join("db")).unwrap();
        let cmd = command(
            &store,
            Action::CreateContact {
                language_id: "es".into(),
                details: crate::persona::starter("es").unwrap(),
            },
        );
        let first = store.execute(cmd.clone()).unwrap();
        let second = store.execute(cmd.clone()).unwrap();
        assert_eq!(first.entity_id, second.entity_id);
        assert_eq!(store.snapshot().unwrap().personas.len(), 1);
        let mut other = cmd;
        other.action = Action::CreateContact {
            language_id: "fr".into(),
            details: crate::persona::starter("fr").unwrap(),
        };
        assert_eq!(store.execute(other).unwrap_err().code, ErrorCode::Conflict);
    }
    #[test]
    fn stale_settings_and_invalid_language_do_not_partially_write() {
        let directory = tempfile::tempdir().unwrap();
        let mut store = Store::open(&directory.path().join("db")).unwrap();
        let contact = contact(&mut store);
        let convo = conversation(&mut store, &contact, "Plans");
        let mut invalid = convo.settings.clone();
        invalid.variety_id = "fr-FR".into();
        let before = store.snapshot().unwrap().revision;
        let invalid_cmd = command(
            &store,
            Action::UpdateSettings {
                conversation_id: convo.id.clone(),
                expected_revision: 1,
                settings: invalid,
            },
        );
        assert_eq!(
            store.execute(invalid_cmd).unwrap_err().code,
            ErrorCode::Validation
        );
        assert_eq!(store.snapshot().unwrap().revision, before);
        apply(
            &mut store,
            Action::UpdateSettings {
                conversation_id: convo.id.clone(),
                expected_revision: 1,
                settings: convo.settings.clone(),
            },
        );
        let stale = command(
            &store,
            Action::UpdateSettings {
                conversation_id: convo.id,
                expected_revision: 1,
                settings: convo.settings,
            },
        );
        assert_eq!(store.execute(stale).unwrap_err().code, ErrorCode::Conflict);
    }
    #[test]
    fn deletion_cascades_without_touching_other_personas_or_profiles() {
        let directory = tempfile::tempdir().unwrap();
        let mut store = Store::open(&directory.path().join("db")).unwrap();
        let one = contact(&mut store);
        let two = contact(&mut store);
        let deleted = conversation(&mut store, &one, "Delete me");
        let kept = conversation(&mut store, &two, "Keep me");
        apply(
            &mut store,
            Action::DeleteContact {
                contact_id: one.id.clone(),
                expected_revision: 1,
            },
        );
        let state = store.snapshot().unwrap();
        assert_eq!(state.personas.len(), 1);
        // Two contacts were created, each with its own first conversation.
        assert_eq!(state.conversations.len(), 2);
        assert_eq!(state.conversations[0].id, kept.id);
        assert_eq!(state.language_profiles.len(), 1);
        let late = command(
            &store,
            Action::UpdateSettings {
                conversation_id: deleted.id,
                expected_revision: 1,
                settings: deleted.settings,
            },
        );
        assert_eq!(store.execute(late).unwrap_err().code, ErrorCode::NotFound);
        let orphans: i32 = store
            .connection
            .query_row("SELECT count(*) FROM conversation_settings", [], |r| {
                r.get(0)
            })
            .unwrap();
        // Every surviving conversation keeps exactly one settings row.
        assert_eq!(orphans, 2);
    }
    #[test]
    fn archive_retains_conversations_and_can_be_restored() {
        let directory = tempfile::tempdir().unwrap();
        let mut store = Store::open(&directory.path().join("db")).unwrap();
        let relation = contact(&mut store);
        conversation(&mut store, &relation, "Plans");
        apply(
            &mut store,
            Action::SetContactArchived {
                contact_id: relation.id.clone(),
                expected_revision: 1,
                archived: true,
            },
        );
        // The contact's first conversation plus the one created above.
        assert_eq!(store.snapshot().unwrap().conversations.len(), 2);
        let blocked = command(
            &store,
            Action::CreateConversation {
                contact_id: relation.id.clone(),
                title: "Blocked".into(),
            },
        );
        assert_eq!(
            store.execute(blocked).unwrap_err().code,
            ErrorCode::Validation
        );
        apply(
            &mut store,
            Action::SetContactArchived {
                contact_id: relation.id,
                expected_revision: 2,
                archived: false,
            },
        );
        assert!(!store.snapshot().unwrap().contacts[0].archived);
    }
    #[test]
    fn preferences_survive_restart_and_old_session_is_rejected() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("db");
        let mut store = Store::open(&path).unwrap();
        let old = command(
            &store,
            Action::CreateContact {
                language_id: "es".into(),
                details: crate::persona::starter("es").unwrap(),
            },
        );
        let mut preferences = store.snapshot().unwrap().learner.preferences;
        preferences.text_size = 120;
        preferences.onboarding = OnboardingStatus::Skipped;
        apply(
            &mut store,
            Action::UpdateLearner {
                expected_revision: 1,
                name: "Jon".into(),
                preferences,
            },
        );
        drop(store);
        let mut reopened = Store::open(&path).unwrap();
        let learner = reopened.snapshot().unwrap().learner;
        assert_eq!(learner.preferences.text_size, 120);
        assert_eq!(learner.name, "Jon");
        assert_eq!(learner.preferences.onboarding, OnboardingStatus::Skipped);
        assert_eq!(
            reopened.execute(old).unwrap_err().code,
            ErrorCode::SessionExpired
        );
    }
    #[test]
    fn an_empty_workspace_opens_at_the_one_supported_version() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("skellyspeak.sqlite3");
        let store = Store::open(&path).unwrap();
        assert_eq!(
            store
                .connection
                .pragma_query_value(None, "user_version", |r| r.get::<_, i32>(0))
                .unwrap(),
            SCHEMA_VERSION
        );
        assert!(store.snapshot().is_ok());
        drop(store);
        // Reopening the same file is the ordinary path, not an upgrade.
        assert!(Store::open(&path).is_ok());
    }

    #[test]
    fn any_other_schema_version_is_refused_without_modifying_the_file() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("skellyspeak.sqlite3");
        drop(Store::open(&path).unwrap());
        for version in [3, 5, 8, 9, 10, 11, 12, SCHEMA_VERSION + 1] {
            let connection = Connection::open(&path).unwrap();
            connection
                .pragma_update(None, "user_version", version)
                .unwrap();
            let before: i32 = connection
                .query_row("SELECT revision FROM metadata WHERE singleton=1", [], |r| {
                    r.get(0)
                })
                .unwrap();
            drop(connection);
            let error = match Store::open(&path) {
                Ok(_) => panic!("version {version} must be refused"),
                Err(error) => error,
            };
            assert_eq!(error.code, ErrorCode::Storage);
            assert!(error.message.contains("Factory Reset"), "{}", error.message);
            let connection = Connection::open(&path).unwrap();
            assert_eq!(
                connection
                    .pragma_query_value(None, "user_version", |r| r.get::<_, i32>(0))
                    .unwrap(),
                version
            );
            assert_eq!(
                connection
                    .query_row("SELECT revision FROM metadata WHERE singleton=1", [], |r| r
                        .get::<_, i32>(0))
                    .unwrap(),
                before
            );
        }
    }

    #[test]
    fn generation_receipt_schema_enforces_identity_state_and_nonnegative_usage() {
        let directory = tempfile::tempdir().unwrap();
        let store = Store::open(&directory.path().join("workspace.sqlite3")).unwrap();
        let insert = "INSERT INTO persona_generation_attempts(id,attempt_id,operation_id,language_id,route,requested_model,profile_revision,state,input_tokens,output_tokens) VALUES(?1,?2,?3,'es','custom','fixture',1,?4,?5,?6)";
        store
            .connection
            .execute(
                insert,
                params![
                    "valid",
                    "attempt",
                    "operation",
                    "pending",
                    None::<i64>,
                    None::<i64>
                ],
            )
            .unwrap();
        for (id, attempt, operation, state, input, output) in [
            ("other", "attempt", "other-operation", "pending", 0, 0),
            ("other", "other-attempt", "operation", "pending", 0, 0),
            (
                "other",
                "other-attempt",
                "other-operation",
                "invalid-state",
                0,
                0,
            ),
            (
                "other",
                "other-attempt",
                "other-operation",
                "succeeded",
                -1,
                0,
            ),
            (
                "other",
                "other-attempt",
                "other-operation",
                "succeeded",
                0,
                -1,
            ),
        ] {
            assert!(
                store
                    .connection
                    .execute(
                        insert,
                        params![id, attempt, operation, state, input, output]
                    )
                    .is_err()
            );
        }
    }

    #[test]
    fn malformed_existing_database_is_not_reset() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("db");
        {
            let connection = Connection::open(&path).unwrap();
            connection
                .execute_batch(
                    "CREATE TABLE precious(value TEXT); INSERT INTO precious VALUES('keep');",
                )
                .unwrap();
        }
        assert!(Store::open(&path).is_err());
        let connection = Connection::open(&path).unwrap();
        let value: String = connection
            .query_row("SELECT value FROM precious", [], |r| r.get(0))
            .unwrap();
        assert_eq!(value, "keep");
    }

    #[test]
    fn workspace_lock_prevents_a_second_writer_until_close() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("db");
        let first = Store::open(&path).unwrap();
        assert!(Store::open(&path).is_err());
        drop(first);
        assert!(Store::open(&path).is_ok());
    }

    #[test]
    fn deleting_one_conversation_keeps_its_sibling_and_clears_receipts() {
        let directory = tempfile::tempdir().unwrap();
        let mut store = Store::open(&directory.path().join("db")).unwrap();
        let relation = contact(&mut store);
        let first = conversation(&mut store, &relation, "First");
        let second = conversation(&mut store, &relation, "Second");
        apply(
            &mut store,
            Action::DeleteConversation {
                conversation_id: first.id.clone(),
                expected_revision: 1,
            },
        );
        let snapshot = store.snapshot().unwrap();
        assert_eq!(snapshot.personas.len(), 1);
        // The contact's first conversation survives beside the one kept here.
        assert_eq!(snapshot.conversations.len(), 2);
        assert_eq!(snapshot.conversations[0].id, second.id);
        let remaining: i32 = store
            .connection
            .query_row(
                "SELECT count(*) FROM receipts WHERE conversation_id=?1",
                [&first.id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(remaining, 0);
    }

    #[test]
    fn wire_contract_rejects_unknown_settings_and_language_mutation_fields() {
        let settings = languages::defaults("es", "en").unwrap();
        let mut json = serde_json::to_value(settings).unwrap();
        json["languageDifficulty"] = serde_json::json!("advanced");
        assert!(serde_json::from_value::<PracticeSettings>(json).is_err());
        let action = serde_json::json!({"kind":"updatePersona", "personaId":"id", "expectedRevision":1,
            "details":crate::persona::starter("es").unwrap(), "languageId":"fr"});
        assert!(serde_json::from_value::<Action>(action).is_err());
    }
    #[test]
    fn current_schema_damage_is_refused_without_resetting_data() {
        for damage in [
            "DROP TRIGGER revision_link_update;",
            "DROP TABLE credential_cleanup;",
            "ALTER TABLE turns ADD COLUMN unexpected TEXT;",
            "PRAGMA application_id=42;",
        ] {
            let dir = tempfile::tempdir().unwrap();
            let path = dir.path().join("workspace.sqlite3");
            let store = Store::open(&path).unwrap();
            store
                .connection
                .execute("UPDATE learner SET name='Retained sentinel'", [])
                .unwrap();
            store.connection.execute_batch(damage).unwrap();
            drop(store);
            assert!(Store::open(&path).is_err(), "{damage}");
            let db = Connection::open(&path).unwrap();
            assert_eq!(
                db.query_row("SELECT name FROM learner", [], |r| r.get::<_, String>(0))
                    .unwrap(),
                "Retained sentinel"
            );
            assert_eq!(
                db.pragma_query_value(None, "user_version", |r| r.get::<_, i32>(0))
                    .unwrap(),
                SCHEMA_VERSION
            );
        }
    }
}
