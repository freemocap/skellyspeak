//! Explicit offline experiment export/replay. Never opens or mutates the user's workspace.
use crate::ai::transport::provider::{self, Completion, RequestOutput};
use crate::language::linguistics::{ANALYSIS_VERSION, SourceIdentity, adapter};
use crate::learning::coaching::{coach_observation, conversation_support};
use serde_json::{Value, json};
use std::{env, fs, io::Write};

fn identity(case: &Value) -> SourceIdentity {
    SourceIdentity {
        message_id: case["id"].as_str().unwrap().into(),
        target_language_id: case["context"]["targetLanguage"].as_str().unwrap().into(),
        explanation_language_id: case["context"]["translationLanguage"]
            .as_str()
            .unwrap()
            .into(),
        analysis_version: ANALYSIS_VERSION.into(),
    }
}

#[test]
#[ignore = "Explicit private experiment input/output paths required"]
fn model_comparison_boundary() {
    let input = env::var("MODEL_COMPARISON_INPUT").expect("input path required");
    let output = env::var("MODEL_COMPARISON_OUTPUT").expect("output path required");
    let mut document: Value = serde_json::from_slice(&fs::read(input).unwrap()).unwrap();
    if document["mode"] == "synthetic" {
        super::model_comparison_synthetic::build(&mut document);
    }
    let replay = document["mode"] == "replay";
    for case in document["cases"].as_array_mut().unwrap() {
        let kind = case["kind"].as_str().unwrap();
        let gloss = matches!(kind, "user_word_gloss" | "persona_word_gloss");
        let coach = matches!(kind, "coach_feedback");
        let support = conversation_support::owns(kind);
        assert!(
            gloss
                || coach
                || support
                || matches!(kind, "persona_reply" | "persona_opening" | "coach_reply")
        );
        if replay {
            let completion: Completion =
                serde_json::from_value(case["completion"].clone()).unwrap();
            let checked = if gloss {
                adapter::validate_word_gloss_completion(&identity(case), case["source"].as_str().unwrap(), &completion)
                    .map(|v| json!({"glossCount":v.gloss_count(),"unresolvedScalars":v.unresolved_scalar_count()}))
                    .map_err(|e| format!("{e:?}"))
            } else if coach {
                coach_observation::validate_captured(&case["context"], kind, &completion)
                    .map_err(|e| e.message)
            } else if support {
                conversation_support::validate(kind, &completion).map_err(|e| e.message)
            } else {
                provider::validate_prose(&completion.text)
                    .map(|_| Value::Null)
                    .map_err(|e| e.message)
            };
            case["validation"] = match checked {
                Ok(value) => json!({"valid":true,"validated":value}),
                Err(reason) => json!({"valid":false,"reason":reason}),
            };
        } else {
            let schema = if gloss {
                let context =
                    serde_json::from_value(case["context"]["languageContext"].clone()).unwrap();
                Some(
                    adapter::build_word_gloss_prompt_with_context(
                        &identity(case),
                        case["source"].as_str().unwrap(),
                        &context,
                    )
                    .unwrap()
                    .output_schema,
                )
            } else if coach {
                Some(coach_observation::schema(&case["context"]).unwrap())
            } else if support {
                Some(conversation_support::schema_for_context(
                    kind,
                    &case["context"],
                ))
            } else {
                None
            };
            let output = match &schema {
                Some(schema) => RequestOutput::JsonSchema {
                    max_output_tokens: if gloss || coach { 8192 } else { 2048 },
                    name: if gloss {
                        adapter::FORMAT_ID
                    } else {
                        "coaching"
                    },
                    schema,
                },
                None => RequestOutput::Prose,
            };
            let messages: Vec<provider::PromptMessage> =
                serde_json::from_value(case["messages"].clone()).unwrap();
            let mut payload = provider::payload_with_output(
                case["model"].as_str().unwrap(),
                &messages,
                crate::model::ConnectionRoute::Hosted,
                output,
            )
            .unwrap();
            payload["temperature"] =
                json!(if matches!(kind, "persona_reply" | "persona_opening") {
                    1.1
                } else {
                    0.7
                });
            case["payload"] = payload;
        }
    }
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(output)
        .unwrap();
    file.write_all(&serde_json::to_vec_pretty(&document).unwrap())
        .unwrap();
}
