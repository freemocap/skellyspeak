//! Fictional scenario projection through production capture/prompt builders.
//! Only disposable test workspaces are opened; no network or user storage.
use super::*;
use crate::ai::transport::provider::PromptMessage;
use crate::language::linguistics::{ANALYSIS_VERSION, SourceIdentity, adapter};
use crate::learning::coaching::{self, conversation_support};
use serde_json::{Value, json};

fn enqueue(store: &mut Store, conversation: &str, text: &str, modality: &str) -> String {
    let mut command = send(store, conversation);
    if let Action::SendMessage {
        text: source,
        input,
        ..
    } = &mut command.action
    {
        *source = text.into();
        input.modality = modality.into();
    }
    let turn = store.execute(command).unwrap().entity_id;
    // Isolate conversation history generation. No fictitious assessment is published.
    store.connection.execute(
        "DELETE FROM operations WHERE turn_id=?1 AND kind NOT IN ('persona_context','persona_reply')",
        [&turn],
    ).unwrap();
    turn
}

fn fixed_reply(store: &mut Store, text: &str) -> Dispatch {
    assert!(store.dispatch().unwrap().is_none());
    let dispatch = store.dispatch().unwrap().unwrap();
    store.finish(&dispatch, Ok(reply(text))).unwrap();
    dispatch
}

pub(super) fn build(document: &mut Value) {
    let mut cases = Vec::new();
    for scenario in document["scenarios"].as_array().unwrap() {
        let language = scenario["language"].as_str().unwrap();
        let (_directory, mut store, _) = setup();
        apply(
            &mut store,
            Action::CreateContact {
                language_id: language.into(),
                details: crate::partners::persona::starter(language).unwrap(),
            },
        );
        let contact: String = store
            .connection
            .query_row(
                "SELECT id FROM contacts ORDER BY rowid DESC LIMIT 1",
                [],
                |r| r.get(0),
            )
            .unwrap();
        let conversation = apply(
            &mut store,
            Action::CreateConversation {
                contact_id: contact,
                title: "Fictional model comparison".into(),
            },
        )
        .entity_id;
        let snapshot = store.snapshot().unwrap();
        let current = snapshot
            .conversations
            .iter()
            .find(|c| c.id == conversation)
            .unwrap();
        let mut settings = current.settings.clone();
        settings.difficulty = serde_json::from_value(scenario["difficulty"].clone()).unwrap();
        settings.read_aloud = false;
        // Keep canonical source pairs free of independently sampled persona fragments.
        settings.direction.use_persona_details = false;
        settings.direction.topic = None;
        settings.explanation_language = "english".into();
        if let Some(variety) = scenario["variety"].as_str() {
            settings.variety_id = variety.into();
        }
        apply(
            &mut store,
            Action::UpdateSettings {
                conversation_id: conversation.clone(),
                expected_revision: current.settings_revision,
                settings,
            },
        );
        for exchange in scenario["history"].as_array().unwrap() {
            enqueue(
                &mut store,
                &conversation,
                exchange[0].as_str().unwrap(),
                "text",
            );
            fixed_reply(&mut store, exchange[1].as_str().unwrap());
        }
        let learner = scenario["learner"].as_str().unwrap();
        let partner = scenario["partner"].as_str().unwrap();
        let turn = enqueue(
            &mut store,
            &conversation,
            learner,
            scenario["modality"].as_str().unwrap(),
        );
        let raw: String = store
            .connection
            .query_row("SELECT context FROM turns WHERE id=?1", [&turn], |r| {
                r.get(0)
            })
            .unwrap();
        let mut context: Value = serde_json::from_str(&raw).unwrap();
        for field in [
            "target",
            "retryTargets",
            "speechTarget",
            "speechUsageByAttempt",
        ] {
            context.as_object_mut().unwrap().remove(field);
        }
        let actual: String = store
            .connection
            .query_row(
                "SELECT text FROM messages WHERE turn_id=?1 AND role='user'",
                [&turn],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(actual, learner, "synthetic source must remain verbatim");
        let response = fixed_reply(&mut store, partner);
        let language_context = serde_json::from_value(context["languageContext"].clone()).unwrap();
        for kind in [
            "persona_reply",
            "coach_feedback",
            "user_word_gloss",
            "persona_word_gloss",
            "reply_brief",
            "reply_assistance",
            "reply_explanations",
        ] {
            let source = if kind == "user_word_gloss" {
                learner
            } else {
                partner
            };
            let case_id = format!("{}-{kind}", scenario["id"].as_str().unwrap());
            let messages: Vec<PromptMessage> = match kind {
                "persona_reply" => response.messages.clone(),
                "coach_feedback" => {
                    coaching::prompt(&store.connection, &turn, kind, &context).unwrap()
                }
                "user_word_gloss" | "persona_word_gloss" => {
                    let identity = SourceIdentity {
                        message_id: case_id.clone(),
                        target_language_id: language.into(),
                        explanation_language_id: "english".into(),
                        analysis_version: ANALYSIS_VERSION.into(),
                    };
                    adapter::build_word_gloss_prompt_with_context(
                        &identity,
                        source,
                        &language_context,
                    )
                    .unwrap()
                    .messages
                }
                _ => conversation_support::prompt_for_exchange(
                    partner.into(),
                    Some(learner.into()),
                    kind,
                    &context,
                )
                .unwrap(),
            };
            cases.push(json!({"id":case_id,"origin":"synthetic","scenarioId":scenario["id"],
                "semanticCaseId":scenario["semanticCaseId"],"family":scenario["family"],
                "difficulty":scenario["difficulty"],"encoding":scenario["encoding"],"review":scenario["review"],
                "kind":kind,"language":language,"turn":turn,"conversation":conversation,
                "model":document["models"]["standard_model"],"fastModel":document["models"]["fast_model"],
                "messages":messages,"source":source,"context":context}));
        }
    }
    for variant in cases
        .iter()
        .filter(|c| c["encoding"] == "canonical_variant" && c["kind"] == "persona_reply")
    {
        let original = cases
            .iter()
            .find(|c| c["scenarioId"] == variant["semanticCaseId"] && c["kind"] == variant["kind"])
            .unwrap();
        let a = original["messages"].as_array().unwrap();
        let b = variant["messages"].as_array().unwrap();
        assert_eq!(
            &a[..a.len() - 1],
            &b[..b.len() - 1],
            "canonical source pairs must share prior context"
        );
    }
    document["cases"] = json!(cases);
}
