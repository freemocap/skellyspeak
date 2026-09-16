use super::*;

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
fn language_preferences_seed_new_conversations_without_rewriting_existing_ones() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("workspace.sqlite3");
    let mut store = Store::open(&path).unwrap();
    let contact = contact(&mut store);
    let first = conversation(&mut store, &contact, "First");
    let learner = store.snapshot().unwrap().learner;
    let mut preferences = learner.preferences;
    preferences
        .target_varieties
        .insert("spanish".into(), "spanish-mexico".into());
    preferences.explanation_language = "english".into();
    preferences.explanation_variety_id = "english-united-kingdom".into();
    preferences.interface_locale = "german".into();
    apply(
        &mut store,
        Action::UpdateLearner {
            expected_revision: learner.revision,
            name: learner.name,
            preferences,
        },
    );
    let second = conversation(&mut store, &contact, "Second");
    assert_eq!(second.settings.variety_id, "spanish-mexico");
    assert_eq!(
        second.settings.explanation_variety_id,
        "english-united-kingdom"
    );
    drop(store);
    let snapshot = Store::open(&path).unwrap().snapshot().unwrap();
    assert_eq!(snapshot.learner.preferences.interface_locale, "german");
    assert_eq!(
        snapshot
            .conversations
            .iter()
            .find(|c| c.id == first.id)
            .unwrap()
            .settings,
        first.settings
    );
    assert_eq!(
        snapshot
            .conversations
            .iter()
            .find(|c| c.id == second.id)
            .unwrap()
            .settings,
        second.settings
    );
}

#[test]
fn preferences_survive_restart_and_old_session_is_rejected() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("db");
    let mut store = Store::open(&path).unwrap();
    let old = command(
        &store,
        Action::CreateContact {
            language_id: "spanish".into(),
            details: crate::partners::persona::starter("spanish").unwrap(),
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
fn wire_contract_rejects_unknown_settings_and_language_mutation_fields() {
    let settings = languages::defaults("spanish", "english").unwrap();
    let mut json = serde_json::to_value(settings).unwrap();
    json["languageDifficulty"] = serde_json::json!("advanced");
    assert!(serde_json::from_value::<PracticeSettings>(json).is_err());
    let action = serde_json::json!({"kind":"updatePersona", "personaId":"id", "expectedRevision":1,
        "details":crate::partners::persona::starter("spanish").unwrap(), "languageId":"french"});
    assert!(serde_json::from_value::<Action>(action).is_err());
}

#[test]
fn unavailable_saved_explanation_language_is_refused_on_snapshot() {
    let dir = tempfile::tempdir().unwrap();
    let store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    store.connection.execute("UPDATE learner SET preferences=json_set(preferences,'$.explanationLanguage','unknown_language')",[]).unwrap();
    assert!(store.snapshot().is_err());
}

#[test]
fn appearance_survives_restart_without_changing_conversation_settings() {
    use crate::configuration::appearance::{
        ControlDensity, LayoutSpacing, SurfaceDepth, SurfacePalette,
    };
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("workspace.sqlite3");
    let mut store = Store::open(&path).unwrap();
    store.prepare_chat().unwrap();
    let before = store.snapshot().unwrap();
    let mut preferences = before.learner.preferences.clone();
    preferences.appearance.palette = SurfacePalette::Warm;
    preferences.appearance.control_density = ControlDensity::Compact;
    preferences.appearance.layout_spacing = LayoutSpacing::ExtraTight;
    preferences.appearance.depth = SurfaceDepth::Recessed;
    preferences.appearance.glow_enabled = true;
    preferences.appearance.glow_strength = 65;
    preferences.text_size = 160;
    apply(
        &mut store,
        Action::UpdateLearner {
            expected_revision: before.learner.revision,
            name: before.learner.name,
            preferences: preferences.clone(),
        },
    );
    drop(store);
    let after = Store::open(&path).unwrap().snapshot().unwrap();
    assert_eq!(after.learner.preferences, preferences);
    assert_eq!(
        after.conversations[0].settings,
        before.conversations[0].settings
    );
}
