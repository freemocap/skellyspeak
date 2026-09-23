//! Experiment adapter: export and replay the production two-stage boundary.
use super::*;

#[test]
#[ignore = "exports or replays explicitly requested synthetic experiment artifacts"]
fn evidence_experiment() {
    let path = std::env::var("SKELLY_EVIDENCE_EXPERIMENT").expect("experiment input path");
    let rows: Vec<Value> = serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
    let mut results = Vec::new();
    for row in rows {
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch("CREATE TABLE turns(id TEXT,context TEXT); CREATE TABLE messages(turn_id TEXT,role TEXT,text TEXT);").unwrap();
        let captured = json!({"skillCriteria":row["criteria"],"targetLanguage":"spanish","input":row["state"]["input"]});
        db.execute(
            "INSERT INTO turns VALUES('test',?1)",
            [captured.to_string()],
        )
        .unwrap();
        db.execute(
            "INSERT INTO messages VALUES('test','user',?1)",
            [row["state"]["currentLearnerMessage"].as_str().unwrap()],
        )
        .unwrap();
        let completion = Completion {
            diagnostics: None,
            text: row["answers"].to_string(),
            finish_reason: "stop".into(),
            actual_model: row["model"].as_str().unwrap().into(),
            provider_id: "experiment".into(),
            input_tokens: None,
            output_tokens: None,
        };
        let decisions = super::super::assessment_adapter::validate(
            &db,
            "test",
            &completion,
            crate::model::AssessmentAdapter::JevChoice,
        );
        let outcome = (|| -> Result<Value> {
            let decisions = decisions?;
            let mut captured = captured.clone();
            captured["skillDecisions"] = decisions.clone();
            let count = implicated(&captured)?.len();
            if let Some(output) = row.get("extraction") {
                let completion = Completion {
                    text: output.to_string(),
                    actual_model: row["extractionModel"]
                        .as_str()
                        .unwrap_or("experiment-fast")
                        .into(),
                    ..completion
                };
                let validated = validate_source(
                    row["state"]["currentLearnerMessage"].as_str().unwrap(),
                    &captured,
                    &completion,
                )?;
                return Ok(json!({"validated":validated}));
            }
            if count == 0 {
                return Ok(json!({"skipped":true,"validated":decisions}));
            }
            let messages = prompt_for_source(
                row["state"]["currentLearnerMessage"]
                    .as_str()
                    .unwrap()
                    .into(),
                &captured,
            )?;
            let schema = schema(&captured)?;
            let request = crate::ai::transport::provider::payload_with_output(
                row["fastModel"].as_str().unwrap(),
                &messages,
                crate::model::ConnectionRoute::Custom,
                crate::ai::transport::provider::RequestOutput::JsonSchema {
                    max_output_tokens: crate::ai::transport::provider::MAX_OUTPUT_TOKENS,
                    name: "coaching",
                    schema: &schema,
                },
            )?;
            Ok(json!({"skipped":false,"request":request,"decisions":decisions,"implicated":count}))
        })();
        results.push(match outcome {
            Ok(value) => json!({"id":row["id"],"valid":true,"value":value}),
            Err(error) => json!({"id":row["id"],"valid":false,"error":error}),
        });
    }
    std::fs::write(
        format!("{path}.native.json"),
        serde_json::to_string_pretty(&json!({"version":VERSION,"rows":results})).unwrap(),
    )
    .unwrap();
}
