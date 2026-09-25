use super::*;
use serde_json::{Value, json};

fn start() -> (tempfile::TempDir, Store, String, String, Dispatch) {
    start_with_route(false)
}
fn start_with_route(local: bool) -> (tempfile::TempDir, Store, String, String, Dispatch) {
    let (dir, mut store, conversation) = setup();
    if local {
        store
            .connection
            .execute(
                "UPDATE ai_config SET custom_config=?1",
                [serde_json::to_string(&CustomEndpoint {
                    base_url: "http://127.0.0.1:8765/v1".into(),
                    bearer_auth: false,
                })
                .unwrap()],
            )
            .unwrap();
        store.select_route(2, ConnectionRoute::Custom).unwrap();
    }
    let turn = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    store.connection.execute("DELETE FROM operations WHERE kind NOT IN ('persona_context','persona_reply','skill_assessment','skill_attribution')", []).unwrap();
    assert!(store.dispatch().unwrap().is_none());
    let partner = store.dispatch().unwrap().unwrap();
    let assessment = store.dispatch().unwrap().unwrap();
    assert!(store.dispatch().unwrap().is_none());
    store
        .finish(&partner, Ok(reply("A relevant reply.")))
        .unwrap();
    (dir, store, conversation, turn, assessment)
}
fn profile(store: &Store) -> Value {
    crate::learning::learner::progression::snapshot(store, "spanish").unwrap()
}
fn judgment(store: &Store) -> Value {
    profile(store)["records"][0]["assessment"]["judgments"]
        .as_array()
        .unwrap()
        .iter()
        .find(|j| j["skill_id"] == "questions_answers")
        .unwrap()
        .clone()
}
fn result(quote: &str) -> Completion {
    reply(&json!({"skills":[{"skill_id":"questions_answers","spans":[{"quote":quote,"occurrence":0}]}]}).to_string())
}
#[test]
fn attribution_depends_on_presence_uses_fast_route_and_does_not_award_twice() {
    let (dir, mut store, conversation, turn, assessment) = start();
    let response = skill_assessment::presence(&assessment, &[("questions_answers", "direct")]);
    store.finish(&assessment, Ok(response)).unwrap();
    assert_eq!(profile(&store)["profile"]["xp"], 1);
    assert_eq!(judgment(&store)["evidence_kind"], "whole_message");
    let attribution = store.dispatch().unwrap().unwrap();
    assert!(attribution.decisions.is_none());
    assert_eq!(
        attribution.model,
        store.connection_config().unwrap().fast_model
    );
    let data: Value = serde_json::from_str(&attribution.messages[1].content).unwrap();
    assert_eq!(data["skills"].as_array().unwrap().len(), 1);
    assert_eq!(data["skills"][0]["id"], "questions_answers");
    assert_eq!(data["learnerMessage"], "Hola, ¿cómo estás?");
    store
        .finish(&attribution, Ok(result("¿cómo estás?")))
        .unwrap();
    store
        .finish(&attribution, Ok(result("¿cómo estás?")))
        .unwrap();
    assert_eq!(judgment(&store)["spans"][0]["start"], 6);
    assert_eq!(judgment(&store)["evidence_kind"], "quoted");
    assert_eq!(profile(&store)["profile"]["xp"], 1);
    assert_eq!(
        store
            .conversation_snapshot(&conversation, None)
            .unwrap()
            .messages
            .len(),
        2
    );
    assert!(store.dispatch().unwrap().is_none());
    let state: String = store
        .connection
        .query_row("SELECT state FROM turns WHERE id=?1", [turn], |r| r.get(0))
        .unwrap();
    assert_eq!(state, "succeeded");
    drop(store);
    let store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    assert_eq!(judgment(&store)["evidence_kind"], "quoted");
    assert_eq!(profile(&store)["profile"]["xp"], 1);
}
#[test]
fn empty_or_unmatched_spans_use_original_message_without_fabricated_highlights() {
    for response in [
        result("invented phrase"),
        reply(r#"{"skills":[{"skill_id":"questions_answers","spans":[]}]}"#),
    ] {
        let (_dir, mut store, _, _, assessment) = start();
        store
            .finish(
                &assessment,
                Ok(skill_assessment::presence(
                    &assessment,
                    &[("questions_answers", "contextual")],
                )),
            )
            .unwrap();
        let attribution = store.dispatch().unwrap().unwrap();
        store.finish(&attribution, Ok(response)).unwrap();
        assert_eq!(judgment(&store)["evidence_kind"], "whole_message");
        assert_eq!(judgment(&store)["spans"], json!([]));
        assert_eq!(
            profile(&store)["records"][0]["source"],
            "Hola, ¿cómo estás?"
        );
        assert_eq!(profile(&store)["profile"]["xp"], 1);
    }
}
#[test]
fn threshold_blocks_weak_positive_and_skips_network_when_nothing_qualifies() {
    let (_dir, mut store, _, _, assessment) = start();
    let mut response = skill_assessment::presence(&assessment, &[]);
    let mut value: Value = serde_json::from_str(&response.text).unwrap();
    value["questions_answers"] = json!({"type":"choice","choice":"direct","confidence":0.4,"probabilities":{"direct":0.4,"contextual":0.1,"absent":0.3,"unclear":0.2}});
    response.text = value.to_string();
    store.finish(&assessment, Ok(response)).unwrap();
    assert_eq!(profile(&store)["profile"]["xp"], 0);
    assert_eq!(judgment(&store)["answer"]["choice"], "direct");
    assert_eq!(judgment(&store)["presence"], "absent");
    assert!(store.dispatch().unwrap().is_none());
    assert!(!store.has_ready_work().unwrap());
    let count:i64=store.connection.query_row("SELECT count(*) FROM attempts a JOIN operations o ON o.id=a.operation_id WHERE o.kind='skill_attribution'",[],|r|r.get(0)).unwrap();
    assert_eq!(count, 0);
}
#[test]
fn malformed_response_keeps_credit_and_exposes_error() {
    let (_dir, mut store, _, _, assessment) = start();
    store
        .finish(
            &assessment,
            Ok(skill_assessment::presence(
                &assessment,
                &[("questions_answers", "direct")],
            )),
        )
        .unwrap();
    let attribution = store.dispatch().unwrap().unwrap();
    store
        .finish(&attribution, Ok(reply(r#"{"skills":[]}"#)))
        .unwrap();
    assert_eq!(profile(&store)["profile"]["xp"], 1);
    assert_eq!(profile(&store)["records"][0]["attribution_state"], "failed");
    assert!(
        profile(&store)["records"][0]["attribution_error"]
            .as_str()
            .unwrap()
            .contains("attribution")
    );
    assert_eq!(judgment(&store)["evidence_kind"], "whole_message");
}

#[test]
fn retry_only_localization_preserves_presence_credit_and_rejects_old_completion() {
    let (_dir, mut store, _, turn, assessment) = start();
    store
        .finish(
            &assessment,
            Ok(skill_assessment::presence(
                &assessment,
                &[("questions_answers", "direct")],
            )),
        )
        .unwrap();
    let first = store.dispatch().unwrap().unwrap();
    store.finish(&first, Ok(reply(r#"{"skills":[]}"#))).unwrap();
    control_turn(&store.connection, &turn, TurnControl::Retry).unwrap();
    let retry = store.dispatch().unwrap().unwrap();
    assert_eq!(first.operation, retry.operation);
    assert_ne!(first.attempt, retry.attempt);
    store.finish(&first, Ok(result("Hola"))).unwrap();
    assert_eq!(judgment(&store)["evidence_kind"], "whole_message");
    store.finish(&retry, Ok(result("¿cómo estás?"))).unwrap();
    assert_eq!(judgment(&store)["quotes"], json!(["¿cómo estás?"]));
    assert!(profile(&store)["records"][0]["attribution_error"].is_null());
    assert_eq!(profile(&store)["profile"]["xp"], 1);
    let count:i64=store.connection.query_row("SELECT count(*) FROM attempts a JOIN operations o ON o.id=a.operation_id WHERE o.kind='skill_assessment'",[],|r|r.get(0)).unwrap();
    assert_eq!(count, 1);
}

#[tokio::test]
#[ignore = "Requires local development service; makes one paid attribution request"]
async fn local_attribution_round_trip() {
    let (_dir, mut store, _, _, assessment) = start_with_route(true);
    store
        .finish(
            &assessment,
            Ok(skill_assessment::presence(
                &assessment,
                &[("questions_answers", "direct")],
            )),
        )
        .unwrap();
    let work = store.dispatch().unwrap().unwrap();
    assert_eq!(work.target.url, "http://127.0.0.1:8765/v1/operations");
    let token = std::fs::read_to_string(
        std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../server/.local-server/session-token.txt"),
    )
    .unwrap();
    let client = crate::ai::transport::provider::client().unwrap();
    let output =
        crate::ai::transport::provider::structured_output(work.coaching_schema.as_ref().unwrap());
    let result =
        crate::ai::transport::provider::complete_with_output(&client, token.trim(), &work, output)
            .await;
    store.finish(&work, result).unwrap();
    let record = profile(&store)["records"][0].clone();
    assert!(
        record["attribution_error"].is_null(),
        "{}",
        record["attribution_error"]
    );
    assert_eq!(judgment(&store)["evidence_kind"], "quoted");
    assert_eq!(profile(&store)["profile"]["xp"], 1);
    eprintln!("Local attribution completed; validated original-text spans and unchanged credit.");
}
