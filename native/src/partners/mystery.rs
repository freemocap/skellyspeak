//! Partner-owned discovery rewards. A guess and a reveal are separate durable actions.
use crate::model::*;
use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum PartnerType {
    Standard,
    Mystery,
}
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum MysteryField {
    Occupation,
    Manner,
    Location,
    Age,
    Interests,
}
impl MysteryField {
    fn key(self) -> &'static str {
        match self {
            Self::Occupation => "occupation",
            Self::Manner => "manner",
            Self::Location => "location",
            Self::Age => "age",
            Self::Interests => "interests",
        }
    }
    fn value(self, details: &PersonaDetails) -> String {
        match self {
            Self::Occupation => details.occupation.clone(),
            Self::Manner => details.manner.clone(),
            Self::Location => details.location.clone(),
            Self::Age => details.age.map(|age| age.to_string()).unwrap_or_default(),
            Self::Interests => details.interests.join(" · "),
        }
    }
}
const FIELDS: [MysteryField; 5] = [
    MysteryField::Occupation,
    MysteryField::Manner,
    MysteryField::Location,
    MysteryField::Age,
    MysteryField::Interests,
];
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum RevealState {
    Hidden,
    GuessedUnrevealed,
    Revealed,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct MysteryFieldView {
    pub field: MysteryField,
    pub state: RevealState,
    pub value: Option<String>,
    pub xp: u32,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct MysteryView {
    pub persona_id: String,
    pub persona_revision: i32,
    pub fields: Vec<MysteryFieldView>,
    pub nudge_dismissed: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct MysteryCredit {
    pub persona_id: String,
    pub conversation_id: Option<String>,
    pub field: String,
    pub xp: u32,
}
fn invalid(message: &str) -> AppError {
    AppError::new(ErrorCode::Validation, message)
}
pub(crate) fn owner<'a>(snapshot: &'a Snapshot, conversation: &str) -> Result<&'a Persona> {
    let chat = snapshot
        .conversations
        .iter()
        .find(|c| c.id == conversation && !c.archived)
        .ok_or_else(|| invalid("This conversation is unavailable."))?;
    let contact = snapshot
        .contacts
        .iter()
        .find(|c| c.id == chat.contact_id && !c.archived)
        .ok_or_else(|| invalid("This partner is unavailable."))?;
    let persona = snapshot
        .personas
        .iter()
        .find(|p| p.id == contact.persona_id && p.learner_id == snapshot.learner.id)
        .ok_or_else(|| invalid("This partner is unavailable."))?;
    if persona.details.partner_type != Some(PartnerType::Mystery) {
        return Err(invalid("This partner is not a Mystery partner."));
    }
    Ok(persona)
}
pub(crate) fn dismiss(db: &Connection, conversation: &str) -> Result<()> {
    db.execute(
        "INSERT OR IGNORE INTO mystery_nudges VALUES(?1)",
        [conversation],
    )?;
    Ok(())
}
pub(crate) fn guess(
    db: &Connection,
    snapshot: &Snapshot,
    conversation: &str,
    field: MysteryField,
    value: &str,
    expected: i32,
) -> Result<String> {
    let persona = owner(snapshot, conversation)?;
    if persona.revision != expected {
        return Err(AppError::new(
            ErrorCode::Conflict,
            "The partner changed. Reopen the guess.",
        ));
    }
    if value.len() > 4000 {
        return Err(invalid("The guess is too long."));
    }
    let answer = field.value(&persona.details);
    if answer.trim().is_empty() {
        return Err(invalid("This partner has no value for that field."));
    }
    dismiss(db, conversation)?;
    if answer != value {
        return Ok("incorrect".into());
    }
    let added = db.execute("INSERT OR IGNORE INTO mystery_fields(persona_id,field,value,state,xp,conversation_id) VALUES(?1,?2,?3,'guessed_unrevealed',1,?4)", params![persona.id, field.key(), answer, conversation])?;
    Ok(if added == 1 {
        "correct"
    } else {
        "already_correct"
    }
    .into())
}
pub(crate) fn reveal(
    db: &Connection,
    snapshot: &Snapshot,
    conversation: &str,
    field: MysteryField,
) -> Result<()> {
    let persona = owner(snapshot, conversation)?;
    let exists: bool = db.query_row(
        "SELECT EXISTS(SELECT 1 FROM mystery_fields WHERE persona_id=?1 AND field=?2)",
        params![persona.id, field.key()],
        |r| r.get(0),
    )?;
    if !exists {
        return Err(invalid("Guess this field correctly before revealing it."));
    }
    db.execute(
        "UPDATE mystery_fields SET state='revealed' WHERE persona_id=?1 AND field=?2",
        params![persona.id, field.key()],
    )?;
    Ok(())
}
pub(crate) fn validate_edit(
    db: &Connection,
    persona: &str,
    details: &PersonaDetails,
) -> Result<()> {
    for field in FIELDS {
        let saved: Option<String> = db
            .query_row(
                "SELECT value FROM mystery_fields WHERE persona_id=?1 AND field=?2",
                params![persona, field.key()],
                |r| r.get(0),
            )
            .optional()?;
        if saved.is_some_and(|value| value != field.value(details)) {
            return Err(invalid(
                "A discovered partner field cannot change. Create another partner to use different details.",
            ));
        }
    }
    Ok(())
}
pub(crate) fn view(
    db: &Connection,
    snapshot: &Snapshot,
    conversation: &str,
) -> Result<Option<MysteryView>> {
    let chat = snapshot
        .conversations
        .iter()
        .find(|c| c.id == conversation)
        .ok_or_else(|| invalid("This conversation is unavailable."))?;
    let contact = snapshot
        .contacts
        .iter()
        .find(|c| c.id == chat.contact_id)
        .ok_or_else(|| invalid("This partner is unavailable."))?;
    let persona = snapshot
        .personas
        .iter()
        .find(|p| p.id == contact.persona_id)
        .ok_or_else(|| invalid("This partner is unavailable."))?;
    if persona.details.partner_type != Some(PartnerType::Mystery) {
        return Ok(None);
    }
    let mut fields = Vec::new();
    for field in FIELDS {
        if field.value(&persona.details).trim().is_empty() {
            continue;
        }
        let saved: Option<(String, String)> = db
            .query_row(
                "SELECT state,value FROM mystery_fields WHERE persona_id=?1 AND field=?2",
                params![persona.id, field.key()],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()?;
        let (state, value, xp) = match saved {
            None => (RevealState::Hidden, None, 0),
            Some((state, value)) if state == "revealed" => (RevealState::Revealed, Some(value), 1),
            Some((state, _)) if state == "guessed_unrevealed" => {
                (RevealState::GuessedUnrevealed, None, 1)
            }
            _ => return Err(invalid("Unknown mystery field state.")),
        };
        fields.push(MysteryFieldView {
            field,
            state,
            value,
            xp,
        });
    }
    let nudge_dismissed = db.query_row(
        "SELECT EXISTS(SELECT 1 FROM mystery_nudges WHERE conversation_id=?1)",
        [conversation],
        |r| r.get(0),
    )?;
    Ok(Some(MysteryView {
        persona_id: persona.id.clone(),
        persona_revision: persona.revision,
        fields,
        nudge_dismissed,
    }))
}
pub(crate) fn credits(db: &Connection, target: &str) -> Result<Vec<MysteryCredit>> {
    Ok(db.prepare("SELECT f.persona_id,f.conversation_id,f.field,f.xp FROM mystery_fields f JOIN personas p ON p.id=f.persona_id WHERE p.language_id=?1 ORDER BY f.persona_id,f.field")?.query_map([target],|r|Ok(MysteryCredit{persona_id:r.get(0)?,conversation_id:r.get(1)?,field:r.get(2)?,xp:r.get(3)?}))?.collect::<rusqlite::Result<Vec<_>>>()?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::store::Store;
    fn send(store: &mut Store, action: Action) -> Result<Receipt> {
        store.execute(Command {
            action_id: uuid::Uuid::new_v4().to_string(),
            session_id: store.session_id.clone(),
            action,
        })
    }
    fn prepare(store: &mut Store) -> (String, String, i32) {
        store.prepare_chat().unwrap();
        let snapshot = store.snapshot().unwrap();
        let persona = &snapshot.personas[0];
        let mut details = persona.details.clone();
        details.partner_type = Some(PartnerType::Mystery);
        details.occupation = "Architect".into();
        send(
            store,
            Action::UpdatePersona {
                persona_id: persona.id.clone(),
                expected_revision: persona.revision,
                details,
            },
        )
        .unwrap();
        (
            snapshot.conversations[0].id.clone(),
            persona.id.clone(),
            persona.revision + 1,
        )
    }
    #[test]
    fn guesses_pay_once_reveal_separately_and_survive_reopening() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("workspace.sqlite3");
        let mut store = Store::open(&path).unwrap();
        let (chat, persona, revision) = prepare(&mut store);
        assert!(
            send(
                &mut store,
                Action::RevealMystery {
                    conversation_id: chat.clone(),
                    field: MysteryField::Occupation
                }
            )
            .is_err()
        );
        let action = |value: &str| Action::GuessMystery {
            conversation_id: chat.clone(),
            field: MysteryField::Occupation,
            value: value.into(),
            expected_persona_revision: revision,
        };
        assert_eq!(
            send(&mut store, action("Teacher")).unwrap().entity_id,
            "incorrect"
        );
        assert!(credits(&store.connection, "es").unwrap().is_empty());
        assert_eq!(
            send(&mut store, action("Architect")).unwrap().entity_id,
            "correct"
        );
        assert_eq!(
            send(&mut store, action("Architect")).unwrap().entity_id,
            "already_correct"
        );
        let first = view(&store.connection, &store.snapshot().unwrap(), &chat)
            .unwrap()
            .unwrap();
        let field = first
            .fields
            .iter()
            .find(|f| f.field == MysteryField::Occupation)
            .unwrap();
        assert_eq!(field.state, RevealState::GuessedUnrevealed);
        assert_eq!(field.value, None);
        assert!(first.nudge_dismissed);
        drop(store);
        let mut store = Store::open(&path).unwrap();
        for _ in 0..2 {
            send(
                &mut store,
                Action::RevealMystery {
                    conversation_id: chat.clone(),
                    field: MysteryField::Occupation,
                },
            )
            .unwrap();
        }
        let second = view(&store.connection, &store.snapshot().unwrap(), &chat)
            .unwrap()
            .unwrap();
        let field = second
            .fields
            .iter()
            .find(|f| f.field == MysteryField::Occupation)
            .unwrap();
        assert_eq!(field.state, RevealState::Revealed);
        assert_eq!(field.value.as_deref(), Some("Architect"));
        assert_eq!(credits(&store.connection, "es").unwrap().len(), 1);
        assert_eq!(
            crate::learning::learner::progression::snapshot(&store, "es").unwrap()["profile"]["xp"],
            1
        );
        let snapshot = store.snapshot().unwrap();
        let contact = snapshot
            .contacts
            .iter()
            .find(|c| c.persona_id == persona)
            .unwrap();
        let another = send(
            &mut store,
            Action::CreateConversation {
                contact_id: contact.id.clone(),
                title: "Another".into(),
            },
        )
        .unwrap()
        .entity_id;
        let result = send(
            &mut store,
            Action::GuessMystery {
                conversation_id: another,
                field: MysteryField::Occupation,
                value: "Architect".into(),
                expected_persona_revision: revision,
            },
        )
        .unwrap();
        assert_eq!(result.entity_id, "already_correct");
        assert_eq!(credits(&store.connection, "es").unwrap().len(), 1);
    }
    #[test]
    fn rejects_wrong_scope_stale_guesses_and_changes_to_discovered_fields() {
        let directory = tempfile::tempdir().unwrap();
        let mut store = Store::open(&directory.path().join("workspace.sqlite3")).unwrap();
        let (chat, persona, revision) = prepare(&mut store);
        for (conversation, expected) in [
            ("missing".to_string(), revision),
            (chat.clone(), revision - 1),
        ] {
            assert!(
                send(
                    &mut store,
                    Action::GuessMystery {
                        conversation_id: conversation,
                        field: MysteryField::Occupation,
                        value: "Architect".into(),
                        expected_persona_revision: expected
                    }
                )
                .is_err()
            );
        }
        send(
            &mut store,
            Action::GuessMystery {
                conversation_id: chat.clone(),
                field: MysteryField::Occupation,
                value: "Architect".into(),
                expected_persona_revision: revision,
            },
        )
        .unwrap();
        let mut details = store
            .snapshot()
            .unwrap()
            .personas
            .into_iter()
            .find(|p| p.id == persona)
            .unwrap()
            .details;
        details.occupation = "Teacher".into();
        assert!(
            send(
                &mut store,
                Action::UpdatePersona {
                    persona_id: persona,
                    expected_revision: revision,
                    details
                }
            )
            .is_err()
        );
        assert_eq!(credits(&store.connection, "es").unwrap().len(), 1);
    }
}
