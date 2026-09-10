use crate::{languages, model::*};
use rusqlite::{Connection, OptionalExtension, params};
use std::path::Path;
use uuid::Uuid;

pub struct Store {
    pub(crate) connection: Connection,
    pub(crate) session_id: String,
    _lock: std::fs::File,
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
fn check_revision(actual: i32, expected: i32) -> Result<()> {
    if actual != expected {
        return Err(AppError::new(
            ErrorCode::Conflict,
            "This item changed. Review the saved value before applying your edit again.",
        ));
    }
    Ok(())
}
fn text(value: &str, label: &str, max: usize, empty: bool) -> Result<()> {
    if (!empty && value.trim().is_empty()) || value.chars().count() > max || value.contains('\0') {
        return Err(AppError::new(
            ErrorCode::Validation,
            format!(
                "{label} must {}be at most {max} characters.",
                if empty { "" } else { "be nonempty and " }
            ),
        ));
    }
    Ok(())
}
fn validate_details(details: &PartnerDetails) -> Result<()> {
    text(&details.name, "Name", 80, false)?;
    text(&details.background, "Background", 2000, true)?;
    text(&details.tendencies, "Conversational tendencies", 600, true)?;
    if details.avatar.hue > 359 || !(3..=9).contains(&details.avatar.lobes) {
        return Err(AppError::new(
            ErrorCode::Validation,
            "Avatar hue or shape is outside its supported range.",
        ));
    }
    if details.vibe.len() > 8
        || details.vibe.iter().any(|v| {
            !["🌿", "☀️", "🌊", "📚", "🎵", "🚲", "🍵", "🌙", "🏔️", "🎨"].contains(&v.as_str())
        })
    {
        return Err(AppError::new(
            ErrorCode::Validation,
            "Choose up to eight supported Vibe symbols.",
        ));
    }
    let mut unique = details.vibe.clone();
    unique.sort();
    unique.dedup();
    if unique.len() != details.vibe.len() {
        return Err(AppError::new(
            ErrorCode::Validation,
            "Vibe symbols must be distinct.",
        ));
    }
    Ok(())
}
fn generated_details(language_id: &str) -> PartnerDetails {
    let seed = Uuid::new_v4().as_fields().0;
    let names = match language_id {
        "es" => ["Lucía", "Mateo", "Inés", "Diego"],
        "fr" => ["Camille", "Jules", "Manon", "Louis"],
        "ar" => ["نور", "سامي", "ليلى", "عمر"],
        "zh" => ["小林", "安然", "明月", "子涵"],
        "en" => ["Rowan", "Alex", "Morgan", "Robin"],
        _ => unreachable!("language validated before generation"),
    };
    let interests = [
        (
            "Keeps a small balcony garden and enjoys early morning walks.",
            "Warm, curious, and unhurried.",
            "🌿",
        ),
        (
            "Enjoys cooking for friends and browsing neighborhood markets.",
            "Thoughtful, playful, and attentive.",
            "☀️",
        ),
        (
            "Spends free afternoons reading and listening to music.",
            "Reflective, imaginative, and easygoing.",
            "📚",
        ),
        (
            "Likes cycling, sketching, and exploring unfamiliar streets.",
            "Lively, observant, and welcoming.",
            "🚲",
        ),
    ];
    let (background, tendencies, vibe) = interests[((seed >> 8) % 4) as usize];
    PartnerDetails {
        name: names[(seed % 4) as usize].into(),
        background: background.into(),
        tendencies: tendencies.into(),
        vibe: vec![vibe.into()],
        avatar: AvatarRecipe {
            seed,
            hue: (seed % 360) as u16,
            lobes: 3 + ((seed >> 16) % 7) as u8,
        },
    }
}

impl Store {
    pub fn open(path: &Path) -> Result<Self> {
        let lock = std::fs::OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(false)
            .open(path.with_extension("lock"))
            .map_err(|e| AppError::new(ErrorCode::Storage, e.to_string()))?;
        lock.try_lock().map_err(|e| {
            AppError::new(
                ErrorCode::Storage,
                format!("The workspace is already open or cannot be locked: {e}"),
            )
        })?;
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
                    "Unrecognized database. No data was changed.",
                ));
            }
            let tx = connection.transaction()?;
            tx.execute_batch(include_str!("schema.sql"))?;
            let preferences = Preferences {
                explanation_language: "en".into(),
                text_size: 100,
                text_spacing: 0,
                high_contrast: false,
                onboarding: OnboardingStatus::NotStarted,
            };
            tx.execute(
                "INSERT INTO learner VALUES(?1,1,'Learner',1,?2)",
                params![id(), serde_json::to_string(&preferences)?],
            )?;
            tx.commit()?;
        } else if version != 3 {
            return Err(AppError::new(
                ErrorCode::Storage,
                "Unsupported database schema. No data was changed.",
            ));
        }
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
        let foreign_error = connection.prepare("PRAGMA foreign_key_check")?.exists([])?;
        if foreign_error {
            return Err(AppError::new(
                ErrorCode::Storage,
                "Invalid database ownership references.",
            ));
        }
        let store = Self {
            connection,
            session_id: id(),
            _lock: lock,
        };
        store.snapshot()?;
        store.reconcile_execution()?;
        store.connection.execute("DELETE FROM receipts", [])?;
        Ok(store)
    }

    pub fn prepare_chat(&mut self) -> Result<()> {
        let snapshot = self.snapshot()?;
        if snapshot.conversations.iter().any(|c| {
            !c.archived
                && snapshot
                    .relationships
                    .iter()
                    .any(|r| r.id == c.relationship_id && !r.archived)
        }) {
            return Ok(());
        }
        let action = match snapshot.relationships.iter().find(|r| !r.archived) {
            Some(relationship) => Action::CreateConversation {
                relationship_id: relationship.id.clone(),
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
        let mut partner_scope: Option<String> = None;
        let mut conversation_scope: Option<String> = None;
        let entity_id = match command.action {
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
                conversation_scope = Some(conversation_id);
                turn_id
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
            Action::StartChat { language_id } => {
                let (partner_id, relationship_id) =
                    create_partner(&tx, &snapshot.learner.id, &language_id)?;
                let conversation_id = id();
                let settings = languages::defaults(
                    &language_id,
                    &snapshot.learner.preferences.explanation_language,
                )?;
                tx.execute("INSERT INTO conversations(id,relationship_id,language_id,title,archived,revision,last_used) VALUES(?1,?2,?3,'New conversation',0,1,?4)",params![conversation_id,relationship_id,language_id,revision])?;
                tx.execute(
                    "INSERT INTO conversation_settings VALUES(?1,1,?2)",
                    params![conversation_id, serde_json::to_string(&settings)?],
                )?;
                partner_scope = Some(partner_id);
                conversation_scope = Some(conversation_id.clone());
                conversation_id
            }
            Action::CreatePartner { language_id } => {
                let (partner_id, _) = create_partner(&tx, &snapshot.learner.id, &language_id)?;
                partner_scope = Some(partner_id.clone());
                partner_id
            }
            Action::UpdatePartner {
                partner_id,
                expected_revision,
                details,
            } => {
                let partner = snapshot
                    .partners
                    .iter()
                    .find(|p| p.id == partner_id)
                    .ok_or_else(missing)?;
                check_revision(partner.revision, expected_revision)?;
                validate_details(&details)?;
                tx.execute(
                    "UPDATE partners SET details=?1,revision=revision+1 WHERE id=?2",
                    params![serde_json::to_string(&details)?, partner_id],
                )?;
                partner_scope = Some(partner_id.clone());
                partner_id
            }
            Action::SetRelationshipArchived {
                relationship_id,
                expected_revision,
                archived,
            } => {
                let relationship = snapshot
                    .relationships
                    .iter()
                    .find(|r| r.id == relationship_id)
                    .ok_or_else(missing)?;
                check_revision(relationship.revision, expected_revision)?;
                tx.execute(
                    "UPDATE relationships SET archived=?1,revision=revision+1 WHERE id=?2",
                    params![archived, relationship_id],
                )?;
                partner_scope = Some(relationship.partner_id.clone());
                relationship_id
            }
            Action::DeletePartner {
                partner_id,
                expected_revision,
            } => {
                let partner = snapshot
                    .partners
                    .iter()
                    .find(|p| p.id == partner_id)
                    .ok_or_else(missing)?;
                check_revision(partner.revision, expected_revision)?;
                tx.execute("DELETE FROM partners WHERE id=?1", [&partner_id])?;
                partner_id
            }
            Action::CreateConversation {
                relationship_id,
                title,
            } => {
                text(&title, "Conversation title", 100, false)?;
                let relationship = snapshot
                    .relationships
                    .iter()
                    .find(|r| r.id == relationship_id)
                    .ok_or_else(missing)?;
                if relationship.archived {
                    return Err(AppError::new(
                        ErrorCode::Validation,
                        "Restore this partner before creating a conversation.",
                    ));
                }
                let partner = snapshot
                    .partners
                    .iter()
                    .find(|p| p.id == relationship.partner_id)
                    .ok_or_else(missing)?;
                let recent = snapshot
                    .conversations
                    .iter()
                    .filter(|c| c.relationship_id == relationship_id)
                    .max_by(|a, b| a.last_used.cmp(&b.last_used).then(a.id.cmp(&b.id)));
                let settings = match recent {
                    Some(c) => c.settings.clone(),
                    None => languages::defaults(
                        &partner.language_id,
                        &snapshot.learner.preferences.explanation_language,
                    )?,
                };
                let conversation_id = id();
                tx.execute("INSERT INTO conversations(id,relationship_id,language_id,title,archived,revision,last_used) VALUES(?1,?2,?3,?4,0,1,?5)", params![conversation_id, relationship_id, partner.language_id, title.trim(), revision])?;
                tx.execute(
                    "INSERT INTO conversation_settings VALUES(?1,1,?2)",
                    params![conversation_id, serde_json::to_string(&settings)?],
                )?;
                partner_scope = Some(partner.id.clone());
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
                    "UPDATE conversations SET last_used=?1 WHERE id=?2",
                    params![revision, conversation_id],
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
                text(&title, "Conversation title", 100, false)?;
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
                text(&name, "Learner name", 80, false)?;
                languages::language(&preferences.explanation_language)?;
                if !(75..=150).contains(&preferences.text_size) || preferences.text_spacing > 12 {
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
                partner_scope,
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
    let partners: Vec<Partner> = connection
        .prepare("SELECT id,learner_id,language_id,revision,details FROM partners ORDER BY rowid")?
        .query_map([], |r| {
            Ok(Partner {
                id: r.get(0)?,
                learner_id: r.get(1)?,
                language_id: r.get(2)?,
                revision: r.get(3)?,
                details: decode(r, 4)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let relationships = connection
        .prepare(
            "SELECT id,learner_id,partner_id,archived,revision FROM relationships ORDER BY rowid",
        )?
        .query_map([], |r| {
            Ok(Relationship {
                id: r.get(0)?,
                learner_id: r.get(1)?,
                partner_id: r.get(2)?,
                archived: r.get(3)?,
                revision: r.get(4)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let conversations: Vec<Conversation> = connection.prepare("SELECT c.id,c.relationship_id,c.language_id,c.title,c.archived,c.revision,c.created_at,c.last_used,s.revision,s.settings FROM conversations c JOIN conversation_settings s ON s.conversation_id=c.id ORDER BY c.last_used DESC,c.id DESC")?.query_map([], |r| Ok(Conversation { id:r.get(0)?,relationship_id:r.get(1)?,language_id:r.get(2)?,title:r.get(3)?,archived:r.get(4)?,revision:r.get(5)?,created_at:r.get(6)?,last_used:r.get(7)?,settings_revision:r.get(8)?,settings:decode(r,9)? }))?.collect::<rusqlite::Result<Vec<_>>>()?;
    let total: i64 =
        connection.query_row("SELECT count(*) FROM conversations", [], |r| r.get(0))?;
    if total != conversations.len() as i64 {
        return Err(AppError::new(
            ErrorCode::Storage,
            "Conversation settings are missing.",
        ));
    }
    for partner in &partners {
        languages::language(&partner.language_id)?;
        validate_details(&partner.details)?;
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
        partners,
        relationships,
        conversations,
    })
}

fn create_partner(db: &Connection, learner: &str, language_id: &str) -> Result<(String, String)> {
    languages::language(language_id)?;
    let partner_id = id();
    let relationship_id = id();
    let details = generated_details(language_id);
    db.execute("INSERT INTO language_profiles SELECT ?1,?2,?3 WHERE NOT EXISTS(SELECT 1 FROM language_profiles WHERE learner_id=?2 AND language_id=?3)", params![id(), learner, language_id])?;
    db.execute(
        "INSERT INTO partners VALUES(?1,?2,?3,1,?4)",
        params![
            partner_id,
            learner,
            language_id,
            serde_json::to_string(&details)?
        ],
    )?;
    db.execute(
        "INSERT INTO relationships VALUES(?1,?2,?3,0,1)",
        params![relationship_id, learner, partner_id],
    )?;
    Ok((partner_id, relationship_id))
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
    fn partner(store: &mut Store) -> Relationship {
        apply(
            store,
            Action::CreatePartner {
                language_id: "es".into(),
            },
        );
        store
            .snapshot()
            .unwrap()
            .relationships
            .last()
            .unwrap()
            .clone()
    }
    fn conversation(store: &mut Store, relationship: &Relationship, title: &str) -> Conversation {
        let receipt = apply(
            store,
            Action::CreateConversation {
                relationship_id: relationship.id.clone(),
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
    #[test]
    fn startup_opens_chat_without_setup_and_does_not_duplicate_it() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("practice.sqlite3");
        let mut store = Store::open(&path).unwrap();
        store.prepare_chat().unwrap();
        let snapshot = store.snapshot().unwrap();
        assert_eq!(snapshot.partners.len(), 1);
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
    fn one_click_partner_and_chat_creation_is_atomic_and_replay_safe() {
        let directory = tempfile::tempdir().unwrap();
        let mut store = Store::open(&directory.path().join("practice.sqlite3")).unwrap();
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
        assert_eq!(snapshot.partners.len(), 1);
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
        assert_eq!(store.snapshot().unwrap().partners.len(), 1);
    }
    #[test]
    fn settings_are_independent_copies_of_last_opened_conversation_and_survive_restart() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("practice.sqlite3");
        let mut store = Store::open(&path).unwrap();
        let relationship = partner(&mut store);
        let first = conversation(&mut store, &relationship, "Weekend plans");
        let mut settings = first.settings.clone();
        settings.difficulty = Difficulty::Challenging;
        settings.translation = false;
        apply(
            &mut store,
            Action::UpdateSettings {
                conversation_id: first.id.clone(),
                expected_revision: 1,
                settings: settings.clone(),
            },
        );
        let second = conversation(&mut store, &relationship, "Kitchen stories");
        assert_eq!(second.settings, settings);
        settings.difficulty = Difficulty::Gentle;
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
        let third = conversation(&mut store, &relationship, "Train journey");
        assert_eq!(third.settings.difficulty, Difficulty::Challenging);
        drop(store);
        let snapshot = Store::open(&path).unwrap().snapshot().unwrap();
        assert_eq!(snapshot.conversations.len(), 3);
        assert_eq!(
            snapshot
                .conversations
                .iter()
                .find(|c| c.id == second.id)
                .unwrap()
                .settings
                .difficulty,
            Difficulty::Gentle
        );
        assert_eq!(snapshot.language_profiles.len(), 1);
    }
    #[test]
    fn duplicate_commands_are_idempotent_and_reusing_identity_with_other_payload_fails() {
        let directory = tempfile::tempdir().unwrap();
        let mut store = Store::open(&directory.path().join("db")).unwrap();
        let cmd = command(
            &store,
            Action::CreatePartner {
                language_id: "es".into(),
            },
        );
        let first = store.execute(cmd.clone()).unwrap();
        let second = store.execute(cmd.clone()).unwrap();
        assert_eq!(first.entity_id, second.entity_id);
        assert_eq!(store.snapshot().unwrap().partners.len(), 1);
        let mut other = cmd;
        other.action = Action::CreatePartner {
            language_id: "fr".into(),
        };
        assert_eq!(store.execute(other).unwrap_err().code, ErrorCode::Conflict);
    }
    #[test]
    fn stale_settings_and_invalid_language_do_not_partially_write() {
        let directory = tempfile::tempdir().unwrap();
        let mut store = Store::open(&directory.path().join("db")).unwrap();
        let relationship = partner(&mut store);
        let convo = conversation(&mut store, &relationship, "Plans");
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
    fn deletion_cascades_without_touching_other_partners_or_profiles() {
        let directory = tempfile::tempdir().unwrap();
        let mut store = Store::open(&directory.path().join("db")).unwrap();
        let one = partner(&mut store);
        let two = partner(&mut store);
        let deleted = conversation(&mut store, &one, "Delete me");
        let kept = conversation(&mut store, &two, "Keep me");
        apply(
            &mut store,
            Action::DeletePartner {
                partner_id: one.partner_id,
                expected_revision: 1,
            },
        );
        let state = store.snapshot().unwrap();
        assert_eq!(state.partners.len(), 1);
        assert_eq!(state.conversations.len(), 1);
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
        assert_eq!(orphans, 1);
    }
    #[test]
    fn archive_retains_conversations_and_can_be_restored() {
        let directory = tempfile::tempdir().unwrap();
        let mut store = Store::open(&directory.path().join("db")).unwrap();
        let relation = partner(&mut store);
        conversation(&mut store, &relation, "Plans");
        apply(
            &mut store,
            Action::SetRelationshipArchived {
                relationship_id: relation.id.clone(),
                expected_revision: 1,
                archived: true,
            },
        );
        assert_eq!(store.snapshot().unwrap().conversations.len(), 1);
        let blocked = command(
            &store,
            Action::CreateConversation {
                relationship_id: relation.id.clone(),
                title: "Blocked".into(),
            },
        );
        assert_eq!(
            store.execute(blocked).unwrap_err().code,
            ErrorCode::Validation
        );
        apply(
            &mut store,
            Action::SetRelationshipArchived {
                relationship_id: relation.id,
                expected_revision: 2,
                archived: false,
            },
        );
        assert!(!store.snapshot().unwrap().relationships[0].archived);
    }
    #[test]
    fn preferences_survive_restart_and_old_session_is_rejected() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("db");
        let mut store = Store::open(&path).unwrap();
        let old = command(
            &store,
            Action::CreatePartner {
                language_id: "es".into(),
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
        let relation = partner(&mut store);
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
        assert_eq!(snapshot.partners.len(), 1);
        assert_eq!(snapshot.conversations.len(), 1);
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
        let action = serde_json::json!({"kind":"updatePartner", "partnerId":"id", "expectedRevision":1,
            "details":generated_details("es"), "languageId":"fr"});
        assert!(serde_json::from_value::<Action>(action).is_err());
    }
}
