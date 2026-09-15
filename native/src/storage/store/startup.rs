use super::*;

impl Store {
    pub fn open(path: &Path) -> Result<Self> {
        let ownership = WorkspaceOwnership::acquire(path)?;
        let config = crate::configuration::initialize(
            &path
                .parent()
                .ok_or_else(|| {
                    AppError::new(
                        ErrorCode::ConfigLoad,
                        "Workspace has no configuration directory.",
                    )
                })?
                .join("config"),
        )
        .map_err(|e| AppError::new(ErrorCode::ConfigLoad, e.to_string()))?;
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
            tx.execute_batch(include_str!("../schemas/schema.sql"))?;
            tx.execute_batch(GENERATION_SCHEMA)?;
            tx.pragma_update(None, "user_version", SCHEMA_VERSION)?;
            config.language("en")?;
            let preferences = Preferences {
                theme: Theme::Light,
                explanation_language: "en".into(),
                explanation_variety_id: config.language("en")?.default_variety,
                interface_locale: "en".into(),
                target_varieties: Default::default(),
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
        crate::learning::learner::progression::initialize(&connection)?;
        crate::learning::rewards::reward_settings::initialize(&connection)?;
        let store = Self {
            config,
            connection,
            session_id: id(),
            speech_cache: crate::speech::cache::Cache::default(),
            credential_writes: std::collections::HashSet::new(),
            credential_index: path.with_file_name("credentials.index"),
            ownership,
        };
        store.snapshot()?;
        store.reconcile_execution()?;
        crate::partners::generation::generation_receipts::recover(&store.connection)?;
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
}
